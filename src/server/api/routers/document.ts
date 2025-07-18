//src/server/api/routers/document.ts

// IMPORTANT: If you get type errors about fields not existing on Document model,
// run: npx prisma generate
// This will regenerate the Prisma client with the latest schema
// 
// If errors persist after regenerating, try:
// 1. Delete node_modules/.prisma folder
// 2. Run: npm install
// 3. Run: npx prisma generate
// 4. Restart TypeScript server in VS Code (Ctrl+Shift+P -> "TypeScript: Restart TS Server")
//
// As a last resort, run: chmod +x fix-prisma-types.sh && ./fix-prisma-types.sh

import { z } from "zod";
import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
// Import type overrides if they exist
import "~/types/prisma-overrides";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedProcedure,
  mergeRouters,
} from "../trpc";
import { createCRUDRouter } from "../generators/crud";
import { TRPCError } from "@trpc/server";
import {
  getDocumentSchema,
  getDocumentConfig,
  estimateTokenUsage,
  estimateCost,
  DOCUMENT_CONFIGS,
} from "~/config/documents";
import { Queue } from "bullmq";
import { env } from "~/env";
import { PreferencesSyncService } from "~/server/services/preferences/sync";

// Extended Document type that includes LLM fields
type DocumentWithLLMFields = {
  id: string;
  userId: string;
  type: DocumentType;
  status: DocumentStatus;
  input: any;
  provider?: string | null;
  model?: string | null;
  temperature?: number;
  maxTokens?: number | null;
};

// Create schema for document creation
const createDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  title: z.string().min(1).max(200),
  input: z.record(z.unknown()), // Will be validated against document-specific schema
  // Optional provider settings
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  useCache: z.boolean().optional(),
});

// Create schema for document updates
const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
});

// Base CRUD router for documents
const baseCrudRouter = createCRUDRouter({
  modelName: "document",
  createSchema: createDocumentSchema,
  updateSchema: updateDocumentSchema,
  includeRelations: {
    exports: true,
  },
  beforeCreate: async (data, ctx) => {
    // Validate document type is enabled
    const config = getDocumentConfig(data.type);
    if (!config || !config.enabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Document type ${data.type} is not enabled`,
      });
    }

    // Validate input against document-specific schema
    const schema = getDocumentSchema(data.type);
    const validatedInput = schema.parse(data.input);

    // Check usage limits
    const usage = await ctx.db.usage.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (usage && usage.monthlyDocs >= 100) {
      // Adjust limit as needed
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Monthly document limit reached",
      });
    }

    // Estimate costs
    const outputLength = (validatedInput as any).outputLength ?? "medium";
    const estimatedTokens = estimateTokenUsage(data.type, outputLength);
    const estimatedCost = estimateCost(estimatedTokens);

    return {
      ...data,
      input: validatedInput as Prisma.InputJsonValue,
      status: DocumentStatus.PENDING,
    };
  },
  afterCreate: async (document, ctx) => {
    // Add to processing queue
    const queue = new Queue(`document-generation`, {
      connection: ctx.redis,
    });

    await queue.add(
      "generate",
      {
        documentId: document.id,
        userId: ctx.session.user.id,
        type: document.type,
        input: document.input,
        // Pass provider settings if available
        provider: (document as DocumentWithLLMFields).provider || 'openai',
        model: (document as DocumentWithLLMFields).model || 'gpt-4',
        temperature: (document as DocumentWithLLMFields).temperature ?? 0.7,
        maxTokens: (document as DocumentWithLLMFields).maxTokens || undefined,
      },
      {
        jobId: document.id, // Use document ID as job ID for easy tracking
      },
    );

    // Update usage stats
    await ctx.db.usage.upsert({
      where: { userId: ctx.session.user.id },
      update: {
        documentsCount: { increment: 1 },
        monthlyDocs: { increment: 1 },
      },
      create: {
        userId: ctx.session.user.id,
        documentsCount: 1,
        monthlyDocs: 1,
      },
    });
  },
});

// Extend with additional document-specific procedures
const extraDocumentRouter = createTRPCRouter({
  // Get available document types
  getAvailableTypes: protectedProcedure.query(() => {
    return Object.entries(DOCUMENT_CONFIGS)
      .filter(([_, config]) => config.enabled)
      .map(([type, config]) => ({
        type: type as DocumentType,
        name: config.name,
        description: config.description,
        icon: config.icon,
        exportFormats: config.exportFormats,
      }));
  }),

  // Get document configuration
  getTypeConfig: protectedProcedure
    .input(z.object({ type: z.nativeEnum(DocumentType) }))
    .query(({ input }) => {
      const config = getDocumentConfig(input.type);
      if (!config || !config.enabled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document type not found or not enabled",
        });
      }
      return config;
    }),

  // Generate document (rate limited)
  generate: rateLimitedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      // Check cost limit before creating
      const costCheck = await PreferencesSyncService.checkCostLimit(ctx.session.user.id);
      if (!costCheck.allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: costCheck.reason || 'Cost limit exceeded',
        });
      }

      // Get user preferences if not provided
      let { provider, model, temperature, maxTokens, useCache } = input;

      if (!provider || !model) {
        // For now, we'll use default values
        // Note: userPreferences table needs to be added to your Prisma schema
        const defaultProvider = 'openai';
        const defaultModel = 'gpt-4';

        provider = provider || defaultProvider;
        model = model || defaultModel;
        temperature = temperature ?? 0.7;
        maxTokens = maxTokens ?? undefined; // Convert null to undefined for Prisma
        useCache = useCache ?? true;
      }

      // Use the create method from CRUD router with rate limiting
      return ctx.db.$transaction(async (tx) => {
        // Create document with all required fields
        const documentData: any = {
          userId: ctx.session.user.id,
          title: input.title,
          type: input.type,
          status: 'PENDING',
          input: input.input as Prisma.InputJsonValue,
        };

        // Add optional LLM fields only if they have values
        if (provider) documentData.provider = provider;
        if (model) documentData.model = model;
        if (temperature !== undefined) documentData.temperature = temperature;
        if (maxTokens !== undefined && maxTokens !== null) documentData.maxTokens = maxTokens;

        const document = await tx.document.create({
          data: documentData,
        });

        // Add to queue
        const queue = new Queue(`document-generation`, {
          connection: ctx.redis,
        });

        await queue.add(
          "generate",
          {
            documentId: document.id,
            userId: ctx.session.user.id,
            type: document.type,
            input: document.input,
            // Pass generation preferences
            provider: provider || 'openai',
            model: model || 'gpt-4',
            temperature: temperature ?? 0.7,
            maxTokens: maxTokens || undefined,
            useCache: useCache ?? true,
            preferences: {
              systemPromptStyle: 'professional',
              preferSpeed: false,
            },
          },
          {
            jobId: document.id,
          },
        );

        void PreferencesSyncService.checkAndSendCostAlert(ctx.session.user.id);

        return document;
      });
    }),

  // Get document progress
  getProgress: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
        select: { userId: true, jobId: true },
      });

      if (!document || document.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Get job progress from queue
      const queue = new Queue(`document-generation`, {
        connection: ctx.redis,
      });

      const job = await queue.getJob(input.documentId);
      if (!job) {
        return { progress: 0, status: "pending" };
      }

      return {
        progress: job.progress,
        status: await job.getState(),
        failedReason: job.failedReason,
      };
    }),

  // Cancel document generation
  cancel: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and status
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
        select: { userId: true, status: true },
      });

      if (!document || document.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (
        document.status !== DocumentStatus.PENDING &&
        document.status !== DocumentStatus.PROCESSING
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document cannot be cancelled",
        });
      }

      // Remove from queue
      const queue = new Queue(`document-generation`, {
        connection: ctx.redis,
      });

      const job = await queue.getJob(input.documentId);
      if (job) {
        await job.remove();
      }

      // Update document status
      return ctx.db.document.update({
        where: { id: input.documentId },
        data: { status: DocumentStatus.CANCELLED },
      });
    }),

  // Retry failed document
  retry: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and status - fetch all fields
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document || document.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.status !== DocumentStatus.FAILED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed documents can be retried",
        });
      }

      // Reset document status
      await ctx.db.document.update({
        where: { id: input.documentId },
        data: {
          status: DocumentStatus.PENDING,
          sections: undefined,
          outline: undefined,
        },
      });

      // Re-add to queue
      const queue = new Queue(`document-generation`, {
        connection: ctx.redis,
      });

      await queue.add(
        "generate",
        {
          documentId: document.id,
          userId: ctx.session.user.id,
          type: document.type,
          input: document.input,
          // Include provider settings
          provider: document.provider,
          model: document.model,
          temperature: document.temperature,
          maxTokens: document.maxTokens,
        },
        {
          jobId: document.id,
        },
      );

      return { success: true };
    }),

  // Get document statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db.document.groupBy({
      by: ["status", "type"],
      where: { userId: ctx.session.user.id },
      _count: true,
    });

    const totalDocuments = await ctx.db.document.count({
      where: { userId: ctx.session.user.id },
    });

    const totalCost = await ctx.db.document.aggregate({
      where: { userId: ctx.session.user.id },
      _sum: { totalCost: true },
    });

    return {
      total: totalDocuments,
      byStatus: stats.reduce(
        (
          acc: Record<string, any>,
          item: { status: string | number; _count: any },
        ) => {
          if (!acc[item.status]) acc[item.status] = 0;
          acc[item.status] += item._count;
          return acc;
        },
        {} as Record<DocumentStatus, number>,
      ),
      byType: stats.reduce(
        (
          acc: Record<string, any>,
          item: { type: string | number; _count: any },
        ) => {
          if (!acc[item.type]) acc[item.type] = 0;
          acc[item.type] += item._count;
          return acc;
        },
        {} as Record<DocumentType, number>,
      ),
      totalCost: totalCost._sum.totalCost ?? 0,
    };
  }),
});

export const documentRouter = mergeRouters(baseCrudRouter, extraDocumentRouter);