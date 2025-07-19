//src/server/api/routers/export.ts

import { z } from "zod";
import {
  createTRPCRouter,
  mergeRouters,
  protectedProcedure,
} from "~/server/api/trpc";
import { createCRUDRouter } from "~/server/api/generators/crud";
import { TRPCError } from "@trpc/server";
import { ExportFormat, ExportStatus } from "@prisma/client";
import {
  exportDocument,
  exportMultipleDocuments,
  getAvailableExportFormats,
} from "~/lib/export";
import { Queue } from "bullmq";
import { env } from "~/env";

// Create schema for export
const createExportSchema = z.object({
  documentId: z.string(),
  format: z.nativeEnum(ExportFormat),
});

// Base CRUD router for exports
const baseCrudRouter = createCRUDRouter({
  modelName: "export",
  createSchema: createExportSchema,
  updateSchema: z.object({
    status: z.nativeEnum(ExportStatus).optional(),
  }),
  includeRelations: {
    document: true,
  },
  beforeCreate: async (data, ctx) => {
    // Verify document ownership
    const document = await ctx.db.document.findUnique({
      where: { id: data.documentId },
      select: { userId: true, status: true, type: true },
    });

    if (!document) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    if (document.userId !== ctx.session.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to export this document",
      });
    }

    if (document.status !== "COMPLETED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Document must be completed before exporting",
      });
    }

    // Check if format is supported for this document type
    const availableFormats = getAvailableExportFormats(document.type);
    if (!availableFormats.includes(data.format)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${data.format} export is not supported for ${document.type} documents`,
      });
    }

    return {
      ...data,
      status: ExportStatus.PROCESSING,
    };
  },
  afterCreate: async (exportRecord, ctx) => {
    // Add to export queue
    const queue = new Queue("export-processing", {
      connection: ctx.redis,
    });

    await queue.add(
      "export",
      {
        exportId: exportRecord.id,
        documentId: exportRecord.documentId,
        format: exportRecord.format,
        userId: ctx.session.user.id,
      },
      {
        jobId: exportRecord.id,
      },
    );
  },
});

// Extend with export-specific procedures
const extraExportRouter = createTRPCRouter({
  // Create export with immediate processing (no queue)
  createImmediate: protectedProcedure
    .input(createExportSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership and status
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
        include: { exports: true },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to export this document",
        });
      }

      if (document.status !== "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document must be completed before exporting",
        });
      }

      // Check for recent export of same format
      const recentExport = document.exports.find(
        (exp) =>
          exp.format === input.format &&
          exp.status === "COMPLETED" &&
          exp.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
      );

      if (recentExport) {
        return recentExport;
      }

      try {
        // Export document immediately
        const result = await exportDocument(document, input.format, {
          author: ctx.session.user.name || ctx.session.user.email || undefined,
          saveToFile: true,
        });

        // Create export record
        const exportRecord = await ctx.db.export.create({
          data: {
            documentId: input.documentId,
            userId: ctx.session.user.id,
            format: input.format,
            status: ExportStatus.COMPLETED,
            url: `/api/export/download/${result.filename}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        return exportRecord;
      } catch (error) {
        // Create failed export record
        await ctx.db.export.create({
          data: {
            documentId: input.documentId,
            userId: ctx.session.user.id,
            format: input.format,
            status: ExportStatus.FAILED,
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export document",
          cause: error,
        });
      }
    }),

  // Export multiple documents
  exportMultiple: protectedProcedure
    .input(
      z.object({
        documentIds: z.array(z.string()).min(1).max(50),
        format: z.nativeEnum(ExportFormat),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of all documents
      const documents = await ctx.db.document.findMany({
        where: {
          id: { in: input.documentIds },
          userId: ctx.session.user.id,
          status: "COMPLETED",
        },
      });

      if (documents.length !== input.documentIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some documents not found or not completed",
        });
      }

      // Create export job
      const queue = new Queue("export-processing", {
        connection: ctx.redis,
      });

      const job = await queue.add("export-multiple", {
        documentIds: input.documentIds,
        format: input.format,
        userId: ctx.session.user.id,
      });

      return {
        jobId: job.id,
        message: `Exporting ${documents.length} documents`,
      };
    }),

  // Get available formats for a document
  getAvailableFormats: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.document.findUnique({
        where: { id: input.documentId },
        select: { type: true, userId: true },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this document",
        });
      }

      return getAvailableExportFormats(document.type);
    }),

  // Clean up expired exports
  cleanupExpired: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.export.deleteMany({
      where: {
        userId: ctx.session.user.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return {
      deleted: result.count,
    };
  }),

  // Get export statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await ctx.db.export.groupBy({
      by: ["format", "status"],
      where: { userId: ctx.session.user.id },
      _count: true,
    });

    const totalExports = await ctx.db.export.count({
      where: { userId: ctx.session.user.id },
    });

    const recentExports = await ctx.db.export.count({
      where: {
        userId: ctx.session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    return {
      total: totalExports,
      recent: recentExports,
      byFormat: stats.reduce(
        (acc, item) => {
          if (!acc[item.format]) acc[item.format] = 0;
          acc[item.format] += item._count;
          return acc;
        },
        {} as Record<ExportFormat, number>,
      ),
      byStatus: stats.reduce(
        (acc, item) => {
          if (!acc[item.status]) acc[item.status] = 0;
          acc[item.status] += item._count;
          return acc;
        },
        {} as Record<ExportStatus, number>,
      ),
    };
  }),
});

export const exportRouter = mergeRouters(baseCrudRouter, extraExportRouter);
