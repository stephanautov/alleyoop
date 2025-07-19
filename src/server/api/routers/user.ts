//src/server/api/routers/user.ts

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// User update schema
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

// User preferences schema
const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  emailNotifications: z.boolean().optional(),
  defaultDocumentLength: z.enum(["short", "medium", "long"]).optional(),
  defaultExportFormat: z.enum(["pdf", "docx", "markdown"]).optional(),
});

export const userRouter = createTRPCRouter({
  // Get current user
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        usage: true,
        _count: {
          select: {
            documents: true,
            exports: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
  }),

  // Update user profile
  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      });

      return updated;
    }),

  // Get user statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get document statistics
    const [
      totalDocuments,
      completedDocuments,
      totalExports,
      recentDocuments,
      documentsByType,
    ] = await Promise.all([
      ctx.db.document.count({ where: { userId } }),
      ctx.db.document.count({ where: { userId, status: "COMPLETED" } }),
      ctx.db.export.count({ where: { userId } }),
      ctx.db.document.count({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      ctx.db.document.groupBy({
        by: ["type"],
        where: { userId },
        _count: true,
      }),
    ]);

    // Get usage data
    const usage = await ctx.db.usage.findUnique({
      where: { userId },
    });

    // Calculate average document length
    const avgWordCount = await ctx.db.document.aggregate({
      where: { userId, wordCount: { gt: 0 } },
      _avg: { wordCount: true },
    });

    return {
      documents: {
        total: totalDocuments,
        completed: completedDocuments,
        recent: recentDocuments,
        completionRate:
          totalDocuments > 0
            ? Math.round((completedDocuments / totalDocuments) * 100)
            : 0,
        byType: documentsByType.reduce(
          (acc, item) => {
            acc[item.type] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      exports: {
        total: totalExports,
      },
      usage: {
        documentsThisMonth: usage?.monthlyDocs ?? 0,
        tokensThisMonth: usage?.monthlyTokens ?? 0,
        totalCost: usage?.totalCost ?? 0,
      },
      averageWordCount: Math.round(avgWordCount._avg.wordCount ?? 0),
    };
  }),

  // Get user preferences (stored in local storage for now, but could be in DB)
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    // For now, return defaults
    // In a real app, you might store these in a UserPreferences table
    return {
      theme: "system",
      emailNotifications: true,
      defaultDocumentLength: "medium",
      defaultExportFormat: "pdf",
    };
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(userPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      // For now, just return the input
      // In a real app, you would save to a UserPreferences table
      return input;
    }),

  // Delete user account
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE MY ACCOUNT"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmation !== "DELETE MY ACCOUNT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid confirmation",
        });
      }

      const userId = ctx.session.user.id;

      // Delete user and all related data (cascade delete handles most)
      await ctx.db.user.delete({
        where: { id: userId },
      });

      return { success: true };
    }),

  // Check if username/email is available (for future username feature)
  checkAvailability: publicProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        username: z.string().min(3).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.email) {
        conditions.push({ email: input.email });
      }

      if (input.username) {
        // Username field doesn't exist yet, but this is how you'd check
        // conditions.push({ username: input.username });
      }

      if (conditions.length === 0) {
        return { available: true };
      }

      const existingUser = await ctx.db.user.findFirst({
        where: { OR: conditions },
      });

      return { available: !existingUser };
    }),

  // Get user's API usage for current billing period
  getApiUsage: protectedProcedure.query(async ({ ctx }) => {
    const usage = await ctx.db.usage.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!usage) {
      return {
        documentsUsed: 0,
        documentsLimit: 100, // Free tier limit
        tokensUsed: 0,
        tokensLimit: 1000000, // 1M tokens
        costIncurred: 0,
        resetDate: new Date(new Date().setDate(1)), // First of month
      };
    }

    // Calculate reset date (first of next month)
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      documentsUsed: usage.monthlyDocs,
      documentsLimit: 100, // This could come from a subscription table
      tokensUsed: usage.monthlyTokens,
      tokensLimit: 1000000,
      costIncurred: usage.totalCost,
      resetDate,
    };
  }),
});
