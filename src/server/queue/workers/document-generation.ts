// src/server/queue/workers/document-generation.ts (enhanced version)

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '~/env';
import { db } from '~/server/db';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { LLMService } from '~/server/services/llm';
import { getIO } from '~/server/websocket';
import { ProgressStorageService } from '~/server/services/progress/storage';

interface DocumentJobData {
  documentId: string;
  userId: string;
  documentType: DocumentType;
  input: any;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
}

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const progressStorage = new ProgressStorageService();

export const documentGenerationWorker = new Worker<DocumentJobData>(
  'document-generation',
  async (job: Job<DocumentJobData>) => {
    const { documentId, userId, documentType, input, provider, model } = job.data;
    const startTime = Date.now();

    console.log(`Processing document ${documentId}`);

    try {
      // Get Socket.IO instance
      const io = getIO();

      // Initialize LLM Service
      const llmService = new LLMService({
        provider: provider as any,
        model,
      });

      // Subscribe to progress events
      llmService.onProgress(async (progress) => {
        const progressData = {
          documentId,
          stage: progress.stage as any,
          progress: progress.progress,
          message: progress.message,
          currentSection: progress.currentSection,
          updatedAt: Date.now(),
          startedAt: startTime,
          estimatedTimeRemaining: calculateEstimatedTime(
            progress.progress,
            startTime
          ),
        };

        // Update job progress
        await job.updateProgress(progress.progress);

        // Save to Redis
        await progressStorage.saveProgress(progressData);

        // Broadcast to WebSocket
        io.to(`document:${documentId}`).emit('generation:progress', progressData);
        io.to(`user:${userId}`).emit('generation:progress', progressData);
      });

      // Update document status
      await db.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      // Generate outline
      const outline = await llmService.generateOutline({
        type: documentType,
        input,
        userId,
        documentId,
      });

      // Save outline
      await db.document.update({
        where: { id: documentId },
        data: { outline },
      });

      // Generate sections
      const sections = await llmService.generateSections({
        outline,
        type: documentType,
        input,
        userId,
        documentId,
      });

      // Save sections
      await db.document.update({
        where: { id: documentId },
        data: { sections },
      });

      // Refine document
      const refined = await llmService.refineDocument({
        sections,
        type: documentType,
        requirements: input,
        userId,
        documentId,
      });

      // Calculate word count
      const wordCount = Object.values(refined)
        .join(' ')
        .split(/\s+/)
        .filter(word => word.length > 0).length;

      // Update document with final content
      await db.document.update({
        where: { id: documentId },
        data: {
          sections: refined,
          status: DocumentStatus.COMPLETED,
          completedAt: new Date(),
          wordCount,
        },
      });

      // Send completion event
      const completionData = {
        documentId,
        stage: 'complete' as const,
        progress: 100,
        message: 'Document generation completed!',
        updatedAt: Date.now(),
        startedAt: startTime,
      };

      await progressStorage.saveProgress(completionData);
      io.to(`document:${documentId}`).emit('generation:progress', completionData);
      io.to(`user:${userId}`).emit('generation:complete', { documentId });

      // Clean up progress after a delay
      setTimeout(() => {
        progressStorage.deleteProgress(documentId);
      }, 5000);

      return { success: true, documentId };

    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);

      // Update document status
      await db.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date(),
          },
        },
      });

      // Send error event
      const errorData = {
        documentId,
        stage: 'error' as const,
        progress: 0,
        message: 'Document generation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        canRetry: true,
        updatedAt: Date.now(),
        startedAt: startTime,
      };

      await progressStorage.saveProgress(errorData);

      const io = getIO();
      io.to(`document:${documentId}`).emit('generation:error', {
        documentId,
        error: errorData.error,
        canRetry: true,
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 3,
  }
);

function calculateEstimatedTime(progress: number, startTime: number): number {
  if (progress <= 0) return 0;

  const elapsedTime = Date.now() - startTime;
  const estimatedTotalTime = (elapsedTime / progress) * 100;
  const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);

  return Math.round(remainingTime / 1000); // Return in seconds
}