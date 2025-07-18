// src/server/api/routers/preferences.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { DocumentType } from "@prisma/client";
import type { ProviderName } from "~/server/services/llm";

// Validation schemas
const providerModelSchema = z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini', 'perplexity', 'llama']),
    model: z.string(),
});

const providerModelsSchema = z.record(z.nativeEnum(DocumentType), providerModelSchema);

const userPreferencesSchema = z.object({
    defaultProvider: z.enum(['openai', 'anthropic', 'gemini', 'perplexity', 'llama']).optional(),
    providerModels: providerModelsSchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokensOverride: z.number().positive().optional().nullable(),
    systemPromptStyle: z.enum(['professional', 'creative', 'technical']).optional(),
    monthlyCostLimit: z.number().positive().optional().nullable(),
    costAlertEmail: z.boolean().optional(),
    costAlertWebhook: z.string().url().optional().nullable(),
    preferSpeed: z.boolean().optional(),
    allowFallback: z.boolean().optional(),
    cacheEnabled: z.boolean().optional(),
});

// Default preferences
const DEFAULT_PREFERENCES = {
    defaultProvider: 'openai' as ProviderName,
    providerModels: {},
    temperature: 0.7,
    maxTokensOverride: null,
    systemPromptStyle: 'professional',
    monthlyCostLimit: null,
    costAlertEmail: true,
    costAlertWebhook: null,
    preferSpeed: false,
    allowFallback: true,
    cacheEnabled: true,
};

export const preferencesRouter = createTRPCRouter({
    // Get user preferences
    get: protectedProcedure.query(async ({ ctx }) => {
        const preferences = await ctx.db.userPreferences.findUnique({
            where: { userId: ctx.session.user.id },
        });

        if (!preferences) {
            return DEFAULT_PREFERENCES;
        }

        return {
            ...DEFAULT_PREFERENCES,
            ...preferences,
            providerModels: preferences.providerModels as Record<DocumentType, { provider: ProviderName; model: string }>,
        };
    }),

    // Update user preferences
    update: protectedProcedure
        .input(userPreferencesSchema)
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.db.userPreferences.upsert({
                where: { userId: ctx.session.user.id },
                update: {
                    ...(input as any),
                    providerModels: input.providerModels ? JSON.stringify(input.providerModels) : undefined,
                },
                create: {
                    userId: ctx.session.user.id,
                    ...(input as any),
                    providerModels: input.providerModels ? JSON.stringify(input.providerModels) : {},
                },
            });

            return {
                ...updated,
                providerModels: updated.providerModels as Record<DocumentType, { provider: ProviderName; model: string }>,
            };
        }),

    // Get provider for specific document type
    getProviderForDocument: protectedProcedure
        .input(z.object({ documentType: z.nativeEnum(DocumentType) }))
        .query(async ({ ctx, input }) => {
            const preferences = await ctx.db.userPreferences.findUnique({
                where: { userId: ctx.session.user.id },
                select: {
                    defaultProvider: true,
                    providerModels: true,
                    temperature: true,
                    maxTokensOverride: true,
                    systemPromptStyle: true,
                    preferSpeed: true,
                    cacheEnabled: true,
                },
            });

            if (!preferences) {
                return {
                    provider: DEFAULT_PREFERENCES.defaultProvider,
                    model: null,
                    settings: {
                        temperature: DEFAULT_PREFERENCES.temperature,
                        maxTokens: null,
                        systemPromptStyle: DEFAULT_PREFERENCES.systemPromptStyle,
                        preferSpeed: DEFAULT_PREFERENCES.preferSpeed,
                        cacheEnabled: DEFAULT_PREFERENCES.cacheEnabled,
                    },
                };
            }

            const providerModels = preferences.providerModels as Record<string, any> || {};
            const documentConfig = providerModels[input.documentType];

            return {
                provider: documentConfig?.provider || preferences.defaultProvider || DEFAULT_PREFERENCES.defaultProvider,
                model: documentConfig?.model || null,
                settings: {
                    temperature: preferences.temperature,
                    maxTokens: preferences.maxTokensOverride,
                    systemPromptStyle: preferences.systemPromptStyle,
                    preferSpeed: preferences.preferSpeed,
                    cacheEnabled: preferences.cacheEnabled,
                },
            };
        }),

    // Check if user is approaching cost limit
    checkCostLimit: protectedProcedure.query(async ({ ctx }) => {
        const preferences = await ctx.db.userPreferences.findUnique({
            where: { userId: ctx.session.user.id },
            select: { monthlyCostLimit: true },
        });

        if (!preferences?.monthlyCostLimit) {
            return { withinLimit: true, percentage: 0 };
        }

        // Get current month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usage = await ctx.db.lLMCall.aggregate({
            where: {
                document: {
                    userId: ctx.session.user.id,
                },
                createdAt: {
                    gte: startOfMonth,
                },
            },
            _sum: {
                cost: true,
            },
        });

        const currentCost = usage._sum.cost || 0;
        const percentage = (currentCost / preferences.monthlyCostLimit) * 100;

        return {
            withinLimit: currentCost < preferences.monthlyCostLimit,
            percentage: Math.round(percentage),
            currentCost,
            limit: preferences.monthlyCostLimit,
        };
    }),

    // Validate provider availability (check API keys)
    validateProviders: protectedProcedure.query(async ({ ctx }) => {
        const env = process.env;

        return {
            openai: !!env.OPENAI_API_KEY,
            anthropic: !!env.ANTHROPIC_API_KEY,
            gemini: !!env.GOOGLE_API_KEY,
            perplexity: !!env.PERPLEXITY_API_KEY,
            llama: !!(env.REPLICATE_API_TOKEN || env.TOGETHER_API_KEY || env.GROQ_API_KEY),
        };
    }),
});