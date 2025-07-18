// src/server/api/routers/cache.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import { DocumentType } from "@prisma/client";
import { getCacheService } from "~/server/services/cache";
import { getCacheManager } from "~/server/services/cache/manager";
import { TRPCError } from "@trpc/server";

export const cacheRouter = createTRPCRouter({
    /**
     * Get cache statistics for the current user
     */
    getUserStats: protectedProcedure.query(async ({ ctx }) => {
        const cacheManager = getCacheManager();

        try {
            const stats = await cacheManager.getUserCacheStats(ctx.session.user.id);

            // Get recent cache hits from database
            const recentHits = await ctx.db.cacheEntry.findMany({
                where: {
                    metadata: {
                        path: '$.userId',
                        equals: ctx.session.user.id,
                    },
                    lastHit: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    },
                },
                orderBy: { lastHit: 'desc' },
                take: 10,
                select: {
                    id: true,
                    type: true,
                    provider: true,
                    model: true,
                    hits: true,
                    costSaved: true,
                    lastHit: true,
                    metadata: true,
                },
            });

            return {
                ...stats,
                recentHits,
            };
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get cache statistics',
            });
        }
    }),

    /**
     * Clear cache for a specific document type
     */
    clearDocumentType: protectedProcedure
        .input(z.object({
            documentType: z.nativeEnum(DocumentType),
        }))
        .mutation(async ({ input, ctx }) => {
            const cacheService = getCacheService();

            try {
                const cleared = await cacheService.clearByDocumentType(input.documentType);

                // Log the action
                await ctx.db.systemLog.create({
                    data: {
                        type: 'CACHE_CLEAR',
                        userId: ctx.session.user.id,
                        message: `Cleared cache for ${input.documentType}`,
                        metadata: {
                            documentType: input.documentType,
                            entriesCleared: cleared,
                        },
                    },
                });

                return {
                    success: true,
                    entriesCleared: cleared,
                };
            } catch (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to clear cache',
                });
            }
        }),

    /**
     * Get global cache statistics (admin only)
     */
    getGlobalStats: adminProcedure.query(async ({ ctx }) => {
        const cacheService = getCacheService();

        try {
            const stats = await cacheService.getStats();

            // Get cache distribution by type
            const distribution = await ctx.db.cacheEntry.groupBy({
                by: ['type', 'provider'],
                _count: {
                    _all: true,
                },
                _sum: {
                    hits: true,
                    costSaved: true,
                },
            });

            // Get top cached patterns
            const topPatterns = await ctx.db.cacheEntry.findMany({
                orderBy: { hits: 'desc' },
                take: 20,
                select: {
                    id: true,
                    key: true,
                    type: true,
                    provider: true,
                    model: true,
                    hits: true,
                    costSaved: true,
                    createdAt: true,
                    expiresAt: true,
                },
            });

            return {
                ...stats,
                distribution,
                topPatterns,
            };
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get global cache statistics',
            });
        }
    }),

    /**
     * Clear all cache (admin only)
     */
    clearAll: adminProcedure.mutation(async ({ ctx }) => {
        const cacheService = getCacheService();

        try {
            const cleared = await cacheService.clearByPattern('*');

            // Also clear database entries
            await ctx.db.cacheEntry.deleteMany();

            // Log the action
            await ctx.db.systemLog.create({
                data: {
                    type: 'CACHE_CLEAR_ALL',
                    userId: ctx.session.user.id,
                    message: 'Cleared all cache entries',
                    metadata: {
                        entriesCleared: cleared,
                    },
                },
            });

            return {
                success: true,
                entriesCleared: cleared,
            };
        } catch (error) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to clear all cache',
            });
        }
    }),

    /**
     * Warm cache for specific patterns
     */
    warmCache: adminProcedure
        .input(z.object({
            documentType: z.nativeEnum(DocumentType),
            provider: z.string(),
            model: z.string(),
            patterns: z.array(z.any()).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Queue cache warming job
            const { Queue } = await import('bullmq');
            const queue = new Queue('cache-warmer', {
                connection: {
                    url: env.REDIS_URL,
                },
            });

            const job = await queue.add('warm-cache', {
                documentType: input.documentType,
                provider: input.provider,
                model: input.model,
                patterns: input.patterns,
                userId: ctx.session.user.id,
            });

            return {
                success: true,
                jobId: job.id,
            };
        }),

    /**
     * Check cache health
     */
    health: protectedProcedure.query(async () => {
        const cacheService = getCacheService();

        try {
            const healthy = await cacheService.healthCheck();
            const stats = await cacheService.getStats();

            return {
                healthy,
                stats: {
                    totalEntries: stats.totalEntries,
                    memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024),
                },
            };
        } catch (error) {
            return {
                healthy: false,
                error: 'Cache service unavailable',
            };
        }
    }),
});