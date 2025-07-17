// File: src/server/api/routers/knowledge.ts
// ============================================

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { RAGService } from "~/server/services/rag";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/env";

const s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
});

export const knowledgeRouter = createTRPCRouter({
    // Upload a knowledge source
    upload: protectedProcedure
        .input(z.object({
            name: z.string(),
            description: z.string().optional(),
            content: z.string(), // Base64 encoded file content
            mimeType: z.string(),
            fileName: z.string(),
            tags: z.array(z.string()).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const buffer = Buffer.from(input.content, "base64");
            const fileSize = buffer.length;

            // Validate file size (10MB limit)
            if (fileSize > 10 * 1024 * 1024) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "File size exceeds 10MB limit",
                });
            }

            // Generate storage key
            const storageKey = `knowledge/${ctx.session.user.id}/${uuidv4()}-${input.fileName}`;

            // Upload to S3 (or save locally in development)
            if (env.NODE_ENV === "production") {
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: env.AWS_S3_BUCKET,
                        Key: storageKey,
                        Body: buffer,
                        ContentType: input.mimeType,
                    })
                );
            } else {
                // In development, save to local filesystem
                const fs = await import("fs/promises");
                const path = await import("path");
                const localPath = path.join(process.cwd(), "uploads", storageKey);
                await fs.mkdir(path.dirname(localPath), { recursive: true });
                await fs.writeFile(localPath, buffer);
            }

            // Create knowledge source record
            const source = await ctx.db.knowledgeSource.create({
                data: {
                    userId: ctx.session.user.id,
                    name: input.name,
                    description: input.description,
                    type: "DOCUMENT",
                    mimeType: input.mimeType,
                    originalName: input.fileName,
                    fileSize,
                    storageKey,
                    tags: input.tags || [],
                    status: "PENDING",
                },
            });

            // Process document asynchronously
            const ragService = new RAGService(ctx.db);
            ragService.ingestDocument(source.id, buffer, input.mimeType).catch(error => {
                console.error("Failed to process document:", error);
            });

            return source;
        }),

    // List knowledge sources
    list: protectedProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            cursor: z.string().optional(),
            status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const sources = await ctx.db.knowledgeSource.findMany({
                where: {
                    userId: ctx.session.user.id,
                    status: input.status,
                },
                take: input.limit + 1,
                cursor: input.cursor ? { id: input.cursor } : undefined,
                orderBy: { createdAt: "desc" },
            });

            let nextCursor: string | undefined = undefined;
            if (sources.length > input.limit) {
                const nextItem = sources.pop();
                nextCursor = nextItem!.id;
            }

            return {
                sources,
                nextCursor,
            };
        }),

    // Delete knowledge source
    delete: protectedProcedure
        .input(z.object({
            id: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const source = await ctx.db.knowledgeSource.findUnique({
                where: { id: input.id },
            });

            if (!source || source.userId !== ctx.session.user.id) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Knowledge source not found",
                });
            }

            // Delete from storage
            if (source.storageKey) {
                if (env.NODE_ENV === "production") {
                    // Delete from S3
                    // Implementation depends on your S3 setup
                } else {
                    // Delete from local filesystem
                    const fs = await import("fs/promises");
                    const path = await import("path");
                    const localPath = path.join(process.cwd(), "uploads", source.storageKey);
                    await fs.unlink(localPath).catch(() => { });
                }
            }

            // Delete from database (cascades to embeddings)
            await ctx.db.knowledgeSource.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),

    // Search knowledge base
    search: protectedProcedure
        .input(z.object({
            query: z.string(),
            sourceIds: z.array(z.string()).optional(),
            limit: z.number().min(1).max(20).default(5),
        }))
        .query(async ({ ctx, input }) => {
            const ragService = new RAGService(ctx.db);

            const context = await ragService.retrieveContext(
                input.query,
                ctx.session.user.id,
                {
                    sourceIds: input.sourceIds,
                    limit: input.limit,
                }
            );

            return context;
        }),
});