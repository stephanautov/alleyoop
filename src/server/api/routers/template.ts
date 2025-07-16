//src/server/api/routers/template.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure, mergeRouters } from "~/server/api/trpc";
import { createCRUDRouter } from "~/server/api/generators/crud";
import { TRPCError } from "@trpc/server";
import { DocumentType, Prisma } from "@prisma/client";
import { getDocumentSchema, getDocumentConfig } from "~/config/documents";

// Template creation schema
const createTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.nativeEnum(DocumentType),
    config: z.record(z.unknown()), // Will be validated against document schema
    isPublic: z.boolean().default(false),
});

// Template update schema
const updateTemplateSchema = createTemplateSchema.partial();

// Base CRUD router for templates
const baseCrudRouter = createCRUDRouter({
    modelName: "template",
    createSchema: createTemplateSchema,
    updateSchema: updateTemplateSchema,
    defaultOrderBy: { createdAt: "desc" },
    defaultWhere: { isPublic: true }, // Only show public templates by default
    allowPublicRead: true, // Allow reading public templates without auth
    beforeCreate: async (data, ctx) => {
        // Validate config against document schema
        const schema = getDocumentSchema(data.type);
        try {
            schema.parse(data.config);
        } catch (error) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid template configuration for document type",
                cause: error,
            });
        }

        // Only authenticated users can create templates
        if (!ctx.session?.user) {
            throw new TRPCError({
                code: "UNAUTHORIZED",
                message: "You must be logged in to create templates",
            });
        }

        return {
            ...data,
            createdBy: ctx.session.user.id,
        };
    },
});

// Extend with template-specific procedures
const extraTemplateRouter = createTRPCRouter({
    // Get templates by document type
    getByType: publicProcedure
        .input(
            z.object({
                type: z.nativeEnum(DocumentType),
                includePrivate: z.boolean().default(false),
            })
        )
        .query(async ({ ctx, input }) => {
            const where: any = {
                type: input.type,
            };

            // Include private templates only for authenticated users
            if (input.includePrivate && ctx.session?.user) {
                where.OR = [
                    { isPublic: true },
                    { createdBy: ctx.session.user.id },
                ];
            } else {
                where.isPublic = true;
            }

            const templates = await ctx.db.template.findMany({
                where,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    type: true,
                    isPublic: true,
                    createdAt: true,
                    createdBy: true,
                },
            });

            return templates;
        }),

    // Get user's templates
    getMine: protectedProcedure.query(async ({ ctx }) => {
        const templates = await ctx.db.template.findMany({
            where: { createdBy: ctx.session.user.id },
            orderBy: { createdAt: "desc" },
        });

        return templates;
    }),

    // Clone a template
    clone: protectedProcedure
        .input(
            z.object({
                templateId: z.string(),
                name: z.string().min(1).max(100).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Get original template
            const original = await ctx.db.template.findUnique({
                where: { id: input.templateId },
            });

            if (!original) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Template not found",
                });
            }

            // Check access (public or owned by user)
            if (!original.isPublic && original.createdBy !== ctx.session.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You don't have permission to clone this template",
                });
            }

            // Create cloned template
            const cloned = await ctx.db.template.create({
                data: {
                    name: input.name || `Copy of ${original.name}`,
                    description: original.description,
                    type: original.type,
                    config: original.config as Prisma.InputJsonValue,
                    isPublic: false, // Clones are always private initially
                    createdBy: ctx.session.user.id,
                },
            });

            return cloned;
        }),

    // Create document from template
    createDocument: protectedProcedure
        .input(
            z.object({
                templateId: z.string(),
                title: z.string().min(1).max(200),
                overrides: z.record(z.unknown()).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Get template
            const template = await ctx.db.template.findUnique({
                where: { id: input.templateId },
            });

            if (!template) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Template not found",
                });
            }

            // Check access
            if (!template.isPublic && template.createdBy !== ctx.session.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You don't have permission to use this template",
                });
            }

            // Merge template config with overrides
            const documentInput = {
                ...(template.config as Record<string, unknown>),
                ...(input.overrides ?? {}),
                title: input.title,
            } as Record<string, unknown>;

            // Validate final input
            const schema = getDocumentSchema(template.type);
            try {
                schema.parse(documentInput);
            } catch (error) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Invalid document configuration",
                    cause: error,
                });
            }

            // Create document
            const document = await ctx.db.document.create({
                data: {
                    userId: ctx.session.user.id,
                    title: input.title,
                    type: template.type,
                    status: "PENDING",
                    input: documentInput as Prisma.InputJsonValue,
                },
            });

            // Add to processing queue
            const Queue = await import("bullmq").then((m) => m.Queue);
            const queue = new Queue("document-generation", {
                connection: ctx.redis,
            });

            await queue.add(
                "generate",
                {
                    documentId: document.id,
                    userId: ctx.session.user.id,
                    type: document.type,
                    input: documentInput as Prisma.InputJsonValue,
                },
                {
                    jobId: document.id,
                }
            );

            return document;
        }),

    // Get popular templates
    getPopular: publicProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(20).default(10),
            })
        )
        .query(async ({ ctx, input }) => {
            // For now, return most recently created public templates
            // In a real app, you might track usage and sort by popularity
            const templates = await ctx.db.template.findMany({
                where: { isPublic: true },
                orderBy: { createdAt: "desc" },
                take: input.limit,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    type: true,
                    createdAt: true,
                },
            });

            return templates;
        }),

    // Search templates
    search: publicProcedure
        .input(
            z.object({
                query: z.string().min(1),
                type: z.nativeEnum(DocumentType).optional(),
                limit: z.number().min(1).max(50).default(20),
            })
        )
        .query(async ({ ctx, input }) => {
            const where: any = {
                OR: [
                    { name: { contains: input.query, mode: "insensitive" } },
                    { description: { contains: input.query, mode: "insensitive" } },
                ],
                isPublic: true,
            };

            if (input.type) {
                where.type = input.type;
            }

            const templates = await ctx.db.template.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: input.limit,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    type: true,
                    createdAt: true,
                },
            });

            return templates;
        }),
});

export const templateRouter = mergeRouters(baseCrudRouter, extraTemplateRouter);