//src/server/api/routers/usage.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export const usageRouter = createTRPCRouter({
    // Get current user's usage
    getCurrent: protectedProcedure.query(async ({ ctx }) => {
        const usage = await ctx.db.usage.findUnique({
            where: { userId: ctx.session.user.id },
        });

        if (!usage) {
            // Create usage record if it doesn't exist
            return await ctx.db.usage.create({
                data: {
                    userId: ctx.session.user.id,
                    documentsCount: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    monthlyDocs: 0,
                    monthlyTokens: 0,
                    monthlyResetAt: startOfMonth(new Date()),
                },
            });
        }

        // Check if monthly reset is needed
        const now = new Date();
        const currentMonthStart = startOfMonth(now);

        if (usage.monthlyResetAt < currentMonthStart) {
            // Reset monthly counters
            return await ctx.db.usage.update({
                where: { id: usage.id },
                data: {
                    monthlyDocs: 0,
                    monthlyTokens: 0,
                    monthlyResetAt: currentMonthStart,
                },
            });
        }

        return usage;
    }),

    // Get usage history
    getHistory: protectedProcedure
        .input(
            z.object({
                months: z.number().min(1).max(12).default(6),
            })
        )
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const now = new Date();
            const startDate = subMonths(now, input.months);

            // Get document creation history
            const documents = await ctx.db.document.groupBy({
                by: ["createdAt"],
                where: {
                    userId,
                    createdAt: { gte: startDate },
                },
                _sum: {
                    promptTokens: true,
                    completionTokens: true,
                    totalCost: true,
                },
                _count: true,
            });

            // Group by month
            const monthlyData = documents.reduce((acc, doc) => {
                const month = format(doc.createdAt, "yyyy-MM");
                if (!acc[month]) {
                    acc[month] = {
                        documents: 0,
                        tokens: 0,
                        cost: 0,
                    };
                }

                acc[month].documents += doc._count;
                acc[month].tokens += (doc._sum.promptTokens ?? 0) + (doc._sum.completionTokens ?? 0);
                acc[month].cost += doc._sum.totalCost ?? 0;

                return acc;
            }, {} as Record<string, { documents: number; tokens: number; cost: number }>);

            // Fill in missing months with zeros
            const months = [];
            for (let i = 0; i < input.months; i++) {
                const month = format(subMonths(now, i), "yyyy-MM");
                months.unshift({
                    month,
                    documents: monthlyData[month]?.documents ?? 0,
                    tokens: monthlyData[month]?.tokens ?? 0,
                    cost: monthlyData[month]?.cost ?? 0,
                });
            }

            return months;
        }),

    // Get usage limits and remaining quota
    getLimits: protectedProcedure.query(async ({ ctx }) => {
        const usage = await ctx.db.usage.findUnique({
            where: { userId: ctx.session.user.id },
        });

        // Define limits based on user plan (hardcoded for now)
        // In a real app, these would come from a subscription/plan table
        const limits = {
            monthlyDocuments: 100,
            monthlyTokens: 1000000, // 1M tokens
            maxDocumentLength: "long" as const,
            allowedFormats: ["pdf", "docx", "markdown"] as const,
            queuePriority: "normal" as const,
        };

        const currentUsage = {
            documents: usage?.monthlyDocs ?? 0,
            tokens: usage?.monthlyTokens ?? 0,
        };

        const remaining = {
            documents: Math.max(0, limits.monthlyDocuments - currentUsage.documents),
            tokens: Math.max(0, limits.monthlyTokens - currentUsage.tokens),
        };

        const percentageUsed = {
            documents: limits.monthlyDocuments > 0
                ? Math.round((currentUsage.documents / limits.monthlyDocuments) * 100)
                : 0,
            tokens: limits.monthlyTokens > 0
                ? Math.round((currentUsage.tokens / limits.monthlyTokens) * 100)
                : 0,
        };

        return {
            limits,
            current: currentUsage,
            remaining,
            percentageUsed,
            resetDate: endOfMonth(new Date()),
        };
    }),

    // Check if user can create a document
    checkQuota: protectedProcedure
        .input(
            z.object({
                documentType: z.string(),
                estimatedTokens: z.number().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const usage = await ctx.db.usage.findUnique({
                where: { userId: ctx.session.user.id },
            });

            const limits = {
                monthlyDocuments: 100,
                monthlyTokens: 1000000,
            };

            const canCreate = {
                documents: !usage || usage.monthlyDocs < limits.monthlyDocuments,
                tokens: !usage || usage.monthlyTokens < limits.monthlyTokens,
            };

            if (!canCreate.documents) {
                return {
                    allowed: false,
                    reason: "Monthly document limit reached",
                    resetDate: endOfMonth(new Date()),
                };
            }

            if (input.estimatedTokens && usage) {
                const remainingTokens = limits.monthlyTokens - usage.monthlyTokens;
                if (input.estimatedTokens > remainingTokens) {
                    return {
                        allowed: false,
                        reason: "Insufficient token quota",
                        resetDate: endOfMonth(new Date()),
                    };
                }
            }

            return {
                allowed: true,
                remainingDocuments: limits.monthlyDocuments - (usage?.monthlyDocs ?? 0),
                remainingTokens: limits.monthlyTokens - (usage?.monthlyTokens ?? 0),
            };
        }),

    // Admin: Get all users' usage
    getAllUsersUsage: adminProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(50),
                cursor: z.string().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const usage = await ctx.db.usage.findMany({
                take: input.limit + 1,
                cursor: input.cursor ? { id: input.cursor } : undefined,
                orderBy: { totalCost: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            let nextCursor: typeof input.cursor | undefined = undefined;
            if (usage.length > input.limit) {
                const nextItem = usage.pop();
                nextCursor = nextItem!.id;
            }

            return {
                items: usage,
                nextCursor,
            };
        }),

    // Admin: Get usage statistics
    getStats: adminProcedure.query(async ({ ctx }) => {
        const [
            totalUsers,
            activeUsers,
            totalDocuments,
            totalTokens,
            totalRevenue,
            averageUsagePerUser,
        ] = await Promise.all([
            ctx.db.user.count(),
            ctx.db.usage.count({
                where: { monthlyDocs: { gt: 0 } },
            }),
            ctx.db.usage.aggregate({
                _sum: { documentsCount: true },
            }),
            ctx.db.usage.aggregate({
                _sum: { totalTokens: true },
            }),
            ctx.db.usage.aggregate({
                _sum: { totalCost: true },
            }),
            ctx.db.usage.aggregate({
                _avg: {
                    documentsCount: true,
                    totalTokens: true,
                    totalCost: true,
                },
            }),
        ]);

        return {
            totalUsers,
            activeUsers,
            totalDocuments: totalDocuments._sum.documentsCount ?? 0,
            totalTokens: totalTokens._sum.totalTokens ?? 0,
            totalRevenue: totalRevenue._sum.totalCost ?? 0,
            averagePerUser: {
                documents: Math.round(averageUsagePerUser._avg.documentsCount ?? 0),
                tokens: Math.round(averageUsagePerUser._avg.totalTokens ?? 0),
                cost: averageUsagePerUser._avg.totalCost ?? 0,
            },
        };
    }),
});