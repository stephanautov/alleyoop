// src/server/api/routers/knowledge.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { RAGService } from "~/server/services/rag";
import { SourceType, ProcessingStatus } from "@prisma/client";
import { S3StorageProvider } from "~/server/services/storage/s3-provider";
import { LocalStorageProvider } from "~/server/services/storage/local-provider";
import type { StorageProvider } from "~/server/services/storage/types";

const uploadKnowledgeSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    type: z.nativeEnum(SourceType),
    content: z.string().optional(), // For direct text/URL
    fileBase64: z.string().optional(), // For file uploads
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.any()).optional(),
});

const searchKnowledgeSchema = z.object({
    query: z.string().min(1),
    limit: z.number().min(1).max(20).default(5),
    threshold: z.number().min(0).max(1).default(0.7),
    sourceIds: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
});

export const knowledgeRouter = createTRPCRouter({
    // Upload and process a knowledge source
    upload: protectedProcedure
        .input(uploadKnowledgeSchema)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const ragService = new RAGService(ctx.db);

            try {
                // Create knowledge source record
                const knowledgeSource = await ctx.db.knowledgeSource.create({
                    data: {
                        userId,
                        name: input.name,
                        description: input.description,
                        type: input.type,
                        mimeType: input.mimeType,
                        originalName: input.fileName,
                        tags: input.tags,
                        metadata: input.metadata || {},
                        status: ProcessingStatus.PENDING,
                    },
                });

                // Handle file storage if provided
                if (input.fileBase64 && input.fileName) {
                    const storage = await getStorageProvider(ctx, userId);
                    const buffer = Buffer.from(input.fileBase64, 'base64');

                    const storageKey = await storage.upload(
                        buffer,
                        `knowledge/${userId}/${knowledgeSource.id}/${input.fileName}`
                    );

                    await ctx.db.knowledgeSource.update({
                        where: { id: knowledgeSource.id },
                        data: {
                            storageKey,
                            fileSize: buffer.length,
                        },
                    });
                } else if (input.content) {
                    // Direct content (text or URL)
                    await ctx.db.knowledgeSource.update({
                        where: { id: knowledgeSource.id },
                        data: {
                            content: input.content,
                            url: input.type === SourceType.WEBSITE ? input.content : null,
                        },
                    });
                }

                // Queue for processing
                const queue = ctx.queue.get('rag-processing');
                await queue.add('process-knowledge', {
                    knowledgeSourceId: knowledgeSource.id,
                    userId,
                });

                return {
                    id: knowledgeSource.id,
                    status: 'processing',
                    message: 'Knowledge source uploaded and queued for processing',
                };
            } catch (error) {
                console.error('Knowledge upload error:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to upload knowledge source',
                });
            }
        }),

    // Search across knowledge sources
    search: protectedProcedure
        .input(searchKnowledgeSchema)
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const ragService = new RAGService(ctx.db);

            try {
                const results = await ragService.search(input.query, {
                    userId,
                    limit: input.limit,
                    threshold: input.threshold,
                    sourceIds: input.sourceIds,
                });

                // Enhance results with source metadata
                const enhancedResults = await Promise.all(
                    results.map(async (result) => {
                        const source = await ctx.db.knowledgeSource.findUnique({
                            where: { id: result.sourceId },
                            select: {
                                name: true,
                                type: true,
                                createdAt: true,
                                tags: true,
                            },
                        });

                        return {
                            ...result,
                            source,
                        };
                    })
                );

                return {
                    results: enhancedResults,
                    query: input.query,
                    totalResults: enhancedResults.length,
                };
            } catch (error) {
                console.error('Knowledge search error:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to search knowledge sources',
                });
            }
        }),

    // List user's knowledge sources
    list: protectedProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
            status: z.nativeEnum(ProcessingStatus).optional(),
            tags: z.array(z.string()).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const where = {
                userId,
                ...(input.status && { status: input.status }),
                ...(input.tags?.length && {
                    tags: { hasSome: input.tags },
                }),
            };

            const [sources, total] = await ctx.db.$transaction([
                ctx.db.knowledgeSource.findMany({
                    where,
                    take: input.limit,
                    skip: input.offset,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: {
                            select: { embeddings: true },
                        },
                    },
                }),
                ctx.db.knowledgeSource.count({ where }),
            ]);

            return {
                sources,
                total,
                hasMore: input.offset + sources.length < total,
            };
        }),

    // Get single knowledge source with details
    get: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const source = await ctx.db.knowledgeSource.findFirst({
                where: {
                    id: input.id,
                    userId,
                },
                include: {
                    _count: {
                        select: {
                            embeddings: true,
                            documents: true,
                        },
                    },
                },
            });

            if (!source) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Knowledge source not found',
                });
            }

            return source;
        }),

    // Delete knowledge source
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const source = await ctx.db.knowledgeSource.findFirst({
                where: {
                    id: input.id,
                    userId,
                },
            });

            if (!source) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Knowledge source not found',
                });
            }

            // Delete from storage if exists
            if (source.storageKey) {
                try {
                    const storage = await getStorageProvider(ctx, userId);
                    await storage.delete(source.storageKey);
                } catch (error) {
                    console.error('Failed to delete from storage:', error);
                }
            }

            // Delete from database (cascades to embeddings)
            await ctx.db.knowledgeSource.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),

    // Get processing status for a source
    status: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const source = await ctx.db.knowledgeSource.findFirst({
                where: {
                    id: input.id,
                    userId,
                },
                select: {
                    status: true,
                    error: true,
                    processedAt: true,
                    _count: {
                        select: { embeddings: true },
                    },
                },
            });

            if (!source) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Knowledge source not found',
                });
            }

            // Get progress from Redis if still processing
            let progress = null;
            if (source.status === ProcessingStatus.PROCESSING) {
                const progressKey = `rag:progress:${input.id}`;
                const progressData = await ctx.redis.get(progressKey);
                if (progressData) {
                    progress = JSON.parse(progressData);
                }
            }

            return {
                status: source.status,
                error: source.error,
                processedAt: source.processedAt,
                embeddingCount: source._count.embeddings,
                progress,
            };
        }),
});

// Helper to get storage provider based on user preferences
async function getStorageProvider(ctx: any, userId: string): Promise<StorageProvider> {
    const preferences = await ctx.db.userPreferences.findUnique({
        where: { userId },
        select: { preferredStorage: true },
    });

    const storageType = preferences?.preferredStorage || 'local';

    switch (storageType) {
        case 's3':
            return new S3StorageProvider();
        case 'local':
        default:
            return new LocalStorageProvider();
    }
}