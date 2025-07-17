// src/server/queue/workers/document-generation.ts
import { Job } from 'bullmq';
import { db } from '~/server/db';
import { LLMService } from '~/server/services/llm';
import { DocumentType, DocumentStatus } from '@prisma/client';

export interface DocumentJobData {
    documentId: string;
    userId: string;
    documentType: DocumentType;
    input: any;
    provider?: 'openai' | 'anthropic';
    model?: string;
}

export async function documentGenerationWorker(job: Job<DocumentJobData>) {
    const { documentId, userId, documentType, input, provider, model } = job.data;

    try {
        // Update document status
        await db.document.update({
            where: { id: documentId },
            data: {
                status: DocumentStatus.PROCESSING,
                provider: provider || 'openai',
                model: model || 'gpt-4-turbo-preview',
            },
        });

        // Initialize LLM service
        const llmService = new LLMService({
            provider: provider || 'openai',
            model,
        });

        // Generate document with progress tracking
        const outline = await llmService.generateOutline({
            type: documentType,
            input,
            onProgress: (progress) => {
                job.updateProgress(progress.progress);
            },
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
            onProgress: (progress) => {
                job.updateProgress(progress.progress);
            },
        });

        // Save sections
        await db.document.update({
            where: { id: documentId },
            data: { sections },
        });

        // Refine document
        const finalDocument = await llmService.refineDocument({
            sections,
            type: documentType,
            requirements: input,
        });

        // Calculate costs
        const llmCalls = await db.lLMCall.findMany({
            where: { documentId },
        });

        const totalTokens = llmCalls.reduce((sum, call) => sum + call.totalTokens, 0);
        const totalCost = llmCalls.reduce((sum, call) => sum + call.cost, 0);

        // Update document with final content
        await db.document.update({
            where: { id: documentId },
            data: {
                status: DocumentStatus.COMPLETED,
                completedAt: new Date(),
                wordCount: finalDocument.metadata.wordCount,
                promptTokens: llmCalls.reduce((sum, call) => sum + call.promptTokens, 0),
                completionTokens: llmCalls.reduce((sum, call) => sum + call.completionTokens, 0),
                totalCost,
            },
        });

        return {
            success: true,
            documentId,
            wordCount: finalDocument.metadata.wordCount,
            totalTokens,
            totalCost,
        };

    } catch (error) {
        // Update document status to failed
        await db.document.update({
            where: { id: documentId },
            data: {
                status: DocumentStatus.FAILED,
            },
        });

        throw error;
    }
}