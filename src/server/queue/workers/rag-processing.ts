// src/server/queue/workers/rag-processing.ts
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "~/env";
import { db } from "~/server/db";
import { ProcessingStatus } from "@prisma/client";
import { RAGService } from "~/server/services/rag";
import { getIO } from "~/server/services/socket";
import { ProgressService } from "~/server/services/progress/unified-progress";
import { LocalStorageProvider } from "~/server/services/storage/local-provider";
import { S3StorageProvider } from "~/server/services/storage/s3-provider";

// Initialize Redis
const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

// Job data interface
interface RAGProcessingJob {
    knowledgeSourceId: string;
    userId: string;
}

// Progress stages
const PROGRESS_STAGES = {
    DOWNLOADING: 10,
    EXTRACTING: 25,
    CHUNKING: 40,
    EMBEDDING: 80,
    STORING: 95,
    COMPLETE: 100,
};

/**
 * RAG Processing Worker
 * Processes uploaded documents and generates embeddings
 */
export const ragProcessingWorker = new Worker(
    "rag-processing",
    async (job: Job<RAGProcessingJob>) => {
        const { knowledgeSourceId, userId } = job.data;
        const ragService = new RAGService(db);
        const progressService = new ProgressService();
        const io = getIO();

        // Initialize progress tracking
        const progressId = await progressService.createProgress(
            'rag-embedding',
            knowledgeSourceId,
            userId,
            {
                sourceName: '',
                totalChunks: 0,
                processedChunks: 0,
            }
        );

        try {
            console.log(`[RAG] Processing knowledge source: ${knowledgeSourceId}`);

            // Update status to processing
            const source = await db.knowledgeSource.update({
                where: { id: knowledgeSourceId },
                data: { status: ProcessingStatus.PROCESSING },
            });

            // Update progress with source name
            await progressService.updateProgress(progressId, {
                progress: PROGRESS_STAGES.DOWNLOADING,
                status: 'processing',
                message: `Processing ${source.name}...`,
                metadata: {
                    sourceName: source.name,
                    sourceType: source.type,
                },
            });

            // Broadcast to user
            io.to(`user:${userId}`).emit('rag:processing', {
                sourceId: knowledgeSourceId,
                stage: 'downloading',
                progress: PROGRESS_STAGES.DOWNLOADING,
            });

            // Get content based on source type
            let content: string;

            if (source.content) {
                // Direct content already in database
                content = source.content;
            } else if (source.storageKey) {
                // Download from storage
                await progressService.updateProgress(progressId, {
                    progress: PROGRESS_STAGES.DOWNLOADING,
                    message: 'Downloading file...',
                });

                const storage = await getStorageProvider(userId);
                const buffer = await storage.download(source.storageKey);

                // Extract text based on file type
                await progressService.updateProgress(progressId, {
                    progress: PROGRESS_STAGES.EXTRACTING,
                    message: 'Extracting text content...',
                });

                content = await ragService.extractContent(
                    buffer,
                    source.mimeType || 'text/plain'
                );

                // Store extracted content
                await db.knowledgeSource.update({
                    where: { id: knowledgeSourceId },
                    data: { content },
                });
            } else if (source.url) {
                // Fetch from URL
                await progressService.updateProgress(progressId, {
                    progress: PROGRESS_STAGES.DOWNLOADING,
                    message: 'Fetching from URL...',
                });

                const response = await fetch(source.url);
                content = await response.text();

                await db.knowledgeSource.update({
                    where: { id: knowledgeSourceId },
                    data: { content },
                });
            } else {
                throw new Error('No content source available');
            }

            // Process the content
            await progressService.updateProgress(progressId, {
                progress: PROGRESS_STAGES.CHUNKING,
                message: 'Splitting into chunks...',
            });

            io.to(`user:${userId}`).emit('rag:processing', {
                sourceId: knowledgeSourceId,
                stage: 'chunking',
                progress: PROGRESS_STAGES.CHUNKING,
            });

            const result = await ragService.processSource(knowledgeSourceId, {
                onProgress: async (processed, total) => {
                    const progress = PROGRESS_STAGES.CHUNKING +
                        ((PROGRESS_STAGES.EMBEDDING - PROGRESS_STAGES.CHUNKING) * (processed / total));

                    await progressService.updateProgress(progressId, {
                        progress,
                        message: `Generating embeddings... (${processed}/${total})`,
                        metadata: {
                            totalChunks: total,
                            processedChunks: processed,
                        },
                    });

                    // Broadcast progress
                    io.to(`user:${userId}`).emit('rag:processing', {
                        sourceId: knowledgeSourceId,
                        stage: 'embedding',
                        progress,
                        chunks: { processed, total },
                    });
                },
            });

            // Update final status
            await progressService.updateProgress(progressId, {
                progress: PROGRESS_STAGES.STORING,
                message: 'Finalizing...',
            });

            await db.knowledgeSource.update({
                where: { id: knowledgeSourceId },
                data: {
                    status: ProcessingStatus.COMPLETED,
                    processedAt: new Date(),
                },
            });

            // Complete progress
            await progressService.completeProgress(progressId, {
                chunksProcessed: result.chunksProcessed,
                embeddingsGenerated: result.embeddingsGenerated,
                tokensUsed: result.tokensUsed,
            });

            // Final broadcast
            io.to(`user:${userId}`).emit('rag:complete', {
                sourceId: knowledgeSourceId,
                success: true,
                stats: {
                    chunks: result.chunksProcessed,
                    embeddings: result.embeddingsGenerated,
                },
            });

            console.log(`[RAG] Successfully processed ${result.chunksProcessed} chunks`);

            return {
                success: true,
                sourceId: knowledgeSourceId,
                stats: result,
            };

        } catch (error) {
            console.error(`[RAG] Processing error:`, error);

            // Update error status
            await db.knowledgeSource.update({
                where: { id: knowledgeSourceId },
                data: {
                    status: ProcessingStatus.FAILED,
                    error: error.message,
                },
            });

            // Fail progress
            await progressService.failProgress(progressId, error.message);

            // Broadcast error
            io.to(`user:${userId}`).emit('rag:error', {
                sourceId: knowledgeSourceId,
                error: error.message,
            });

            throw error;
        }
    },
    {
        connection: redis,
        concurrency: 2, // Process 2 documents at a time
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
    }
);

// Helper to get storage provider
async function getStorageProvider(userId: string) {
    const preferences = await db.userPreferences.findUnique({
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

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[RAG Worker] Shutting down gracefully...');
    await ragProcessingWorker.close();
    await redis.disconnect();
    process.exit(0);
});