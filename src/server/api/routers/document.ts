import { z } from "zod";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, rateLimitedProcedure } from "../trpc";
import { createCRUDRouter } from "../generators/crud";
import { TRPCError } from "@trpc/server";
import {
    getDocumentSchema,
    getDocumentConfig,
    estimateTokenUsage,
    estimateCost,
    DOCUMENT_CONFIGS
} from "~/config/documents";
import { Queue } from "bullmq";
import { env } from "~/env";

// Create schema for document creation
const createDocumentSchema = z.object({
    type: z.nativeEnum(DocumentType),
    title: z.string().min(1).max(200),
    input: z.record(z.unknown()), // Will be validated against document-specific schema
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
        if (!config.enabled) {
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

        if (usage && usage.monthlyDocs >= 100) { // Adjust limit as needed
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Monthly document limit reached",
            });
        }

        // Estimate costs
        const outputLength = validatedInput.outputLength || "medium";
        const estimatedTokens = estimateTokenUsage(data.type, outputLength);
        const estimatedCost = estimateCost(estimatedTokens);

        return {
            ...data,
            input: validatedInput,
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
            },
            {
                jobId: document.id, // Use document ID as job ID for easy tracking
            }
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
export const documentRouter = createTRPCRouter({
    // Include all CRUD operations
    ...baseCrudRouter,

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
            if (!config.enabled) {
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
            // Use the create method from CRUD router with rate limiting
            return ctx.db.$transaction(async (tx) => {
                // Create document
                const document = await tx.document.create({
                    data: {
                        userId: ctx.session.user.id,
                        type: input.type,
                        title: input.title,
                        input: input.input,
                        status: DocumentStatus.PENDING,
                    },
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
                    },
                    {
                        jobId: document.id,
                    }
                );

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

            if (document.status !== DocumentStatus.PENDING &&
                document.status !== DocumentStatus.PROCESSING) {
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
            // Verify ownership and status
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
                    sections: null,
                    outline: null,
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
                },
                {
                    jobId: document.id,
                }
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
            byStatus: stats.reduce((acc: { [x: string]: any; }, item: { status: string | number; _count: any; }) => {
                if (!acc[item.status]) acc[item.status] = 0;
                acc[item.status] += item._count;
                return acc;
            }, {} as Record<DocumentStatus, number>),
            byType: stats.reduce((acc: { [x: string]: any; }, item: { type: string | number; _count: any; }) => {
                if (!acc[item.type]) acc[item.type] = 0;
                acc[item.type] += item._count;
                return acc;
            }, {} as Record<DocumentType, number>),
            totalCost: totalCost._sum.totalCost || 0,
        };
    }),
});