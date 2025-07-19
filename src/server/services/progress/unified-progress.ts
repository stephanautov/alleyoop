// src/server/services/progress/unified-progress.ts

import { Redis } from 'ioredis';
import { getIO } from '~/server/websocket';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { env } from '~/env';

// Progress types for all systems
export const ProgressTypeSchema = z.enum([
    'document-generation',
    'rag-embedding',
    'file-generation',
    'bulk-operation',
    'storage-migration',
]);

export type ProgressType = z.infer<typeof ProgressTypeSchema>;

// Unified progress data structure
export const UnifiedProgressSchema = z.object({
    type: ProgressTypeSchema,
    resourceId: z.string(),
    userId: z.string(),
    stage: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string(),
    metadata: z.object({
        // Document generation specific
        provider: z.string().optional(),
        model: z.string().optional(),
        currentSection: z.string().optional(),
        totalSections: z.number().optional(),

        // RAG specific
        chunksProcessed: z.number().optional(),
        totalChunks: z.number().optional(),
        embeddingsGenerated: z.number().optional(),

        // File generation specific
        filesGenerated: z.number().optional(),
        totalFiles: z.number().optional(),
        currentFile: z.string().optional(),

        // Timing
        startedAt: z.number(),
        estimatedTimeRemaining: z.number().optional(),

        // Errors
        error: z.string().optional(),
        retryCount: z.number().optional(),
    }),
});

export type UnifiedProgress = z.infer<typeof UnifiedProgressSchema>;
export type ProgressMetadata = UnifiedProgress['metadata'];

/**
 * Unified progress service that handles all progress tracking
 */
export class UnifiedProgressService extends EventEmitter {
    private redis: Redis;
    private io: any;
    private progressTTL = 3600; // 1 hour
    private completedTTL = 300; // 5 minutes for completed items

    constructor(redisUrl?: string) {
        super();
        this.redis = new Redis(redisUrl || env.REDIS_URL);
        this.io = getIO();
    }

    /**
     * Generate a unique progress ID
     */
    generateProgressId(type: ProgressType, resourceId: string): string {
        return `${type}:${resourceId}:${Date.now()}`;
    }

    /**
     * Get Redis key for progress
     */
    private getRedisKey(progressId: string): string {
        return `progress:${progressId}`;
    }

    /**
     * Get progress key for backward compatibility
     */
    private getProgressKey(type: ProgressType, resourceId: string): string {
        return `progress:${type}:${resourceId}`;
    }

    /**
     * Get room names for broadcasting
     */
    private getProgressRooms(progress: UnifiedProgress): string[] {
        return [
            `progress:${progress.type}:${progress.resourceId}`,
            `user:${progress.userId}:progress`,
        ];
    }

    /**
     * Create new progress entry
     */
    async createProgress(
        type: ProgressType,
        resourceId: string,
        userId: string,
        message: string,
        metadata: Partial<ProgressMetadata> = {}
    ): Promise<string> {
        const progressId = this.generateProgressId(type, resourceId);
        const progress: UnifiedProgress = {
            type,
            resourceId,
            userId,
            stage: 'initializing',
            progress: 0,
            message,
            metadata: {
                startedAt: Date.now(),
                ...metadata,
            },
        };

        await this.saveProgress(progressId, progress);
        this.broadcastProgress(progress);
        this.emit('progress:created', progress);

        return progressId;
    }

    /**
     * Update existing progress
     */
    async updateProgress(
        progressId: string,
        updates: Partial<Omit<UnifiedProgress, 'type' | 'resourceId' | 'userId'>>
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) {
            throw new Error(`Progress not found: ${progressId}`);
        }

        const updated: UnifiedProgress = {
            ...current,
            ...updates,
            metadata: {
                ...current.metadata,
                ...updates.metadata,
            },
        };

        await this.saveProgress(progressId, updated);
        this.broadcastProgress(updated);
        this.emit('progress:updated', updated);
    }

    /**
     * Complete progress
     */
    async completeProgress(
        progressId: string,
        message: string = 'Completed successfully'
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) return;

        await this.updateProgress(progressId, {
            stage: 'completed',
            progress: 100,
            message,
            metadata: {
                ...current.metadata,
                estimatedTimeRemaining: 0,
            },
        });

        // Keep completed progress for a shorter time
        await this.redis.expire(this.getRedisKey(progressId), this.completedTTL);

        const progress = await this.getProgressById(progressId);
        if (progress) {
            this.emit('progress:completed', progress);
        }
    }

    /**
     * Mark progress as failed
     */
    async failProgress(
        progressId: string,
        error: string,
        canRetry: boolean = true
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) return;

        await this.updateProgress(progressId, {
            stage: 'failed',
            message: 'Operation failed',
            metadata: {
                ...current.metadata,
                error,
                estimatedTimeRemaining: 0,
            },
        });

        // Broadcast error event
        if (this.io) {
            const rooms = this.getProgressRooms(current);
            rooms.forEach(room => {
                this.io.to(room).emit('progress:error', {
                    ...current,
                    error,
                    canRetry,
                });
            });
        }

        this.emit('progress:failed', { ...current, error, canRetry });
    }

    /**
     * Get progress by ID
     */
    async getProgressById(progressId: string): Promise<UnifiedProgress | null> {
        const data = await this.redis.get(this.getRedisKey(progressId));
        if (!data) return null;

        try {
            return UnifiedProgressSchema.parse(JSON.parse(data));
        } catch (error) {
            console.error('Invalid progress data:', error);
            return null;
        }
    }

    /**
     * Get progress by type and resource ID
     */
    async getProgress(
        type: ProgressType,
        resourceId: string
    ): Promise<UnifiedProgress | null> {
        const key = this.getProgressKey(type, resourceId);
        const data = await this.redis.get(key);
        if (!data) return null;

        try {
            return UnifiedProgressSchema.parse(JSON.parse(data));
        } catch (error) {
            console.error('Invalid progress data:', error);
            return null;
        }
    }

    /**
     * Get all progress for a user
     */
    async getUserProgress(userId: string): Promise<UnifiedProgress[]> {
        const keys = await this.redis.keys(`progress:*`);
        const progress: UnifiedProgress[] = [];

        for (const key of keys) {
            const data = await this.redis.get(key);
            if (!data) continue;

            try {
                const parsed = UnifiedProgressSchema.parse(JSON.parse(data));
                if (parsed.userId === userId) {
                    progress.push(parsed);
                }
            } catch (error) {
                console.error('Invalid progress data:', error);
            }
        }

        return progress.sort((a, b) => b.metadata.startedAt - a.metadata.startedAt);
    }

    /**
     * Subscribe socket to progress updates
     */
    subscribeSocket(progressId: string, userId: string, socketId: string): void {
        if (!this.io) return;

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) return;

        // Join progress-specific room
        socket.join(`progress:${progressId}`);

        // Join user progress room
        socket.join(`user:${userId}:progress`);
    }

    /**
     * Unsubscribe socket from progress updates
     */
    unsubscribeSocket(progressId: string, socketId: string): void {
        if (!this.io) return;

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) return;

        socket.leave(`progress:${progressId}`);
    }

    /**
     * Backward compatibility: Set progress (creates or updates)
     */
    async setProgress(progress: UnifiedProgress): Promise<void> {
        const key = this.getProgressKey(progress.type, progress.resourceId);
        const validated = UnifiedProgressSchema.parse(progress);

        await this.redis.set(
            key,
            JSON.stringify(validated),
            'EX',
            this.progressTTL
        );

        this.broadcastProgress(validated);
        this.emit('progress', validated);
    }

    /**
     * Document-specific progress methods
     */
    async createDocumentProgress(
        documentId: string,
        userId: string,
        provider: string,
        model: string
    ): Promise<string> {
        return this.createProgress(
            'document-generation',
            documentId,
            userId,
            'Initializing document generation...',
            {
                startedAt: Date.now(),
                provider,
                model,
            }
        );
    }

    async updateDocumentProgress(
        progressId: string,
        stage: 'outline' | 'sections' | 'refinement',
        progress: number,
        currentSection?: string
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) return;

        const stageMessages = {
            outline: 'Creating document outline...',
            sections: 'Writing content sections...',
            refinement: 'Refining and polishing content...',
        };

        await this.updateProgress(progressId, {
            stage,
            progress,
            message: stageMessages[stage],
            metadata: {
                ...current.metadata,
                currentSection,
            },
        });
    }

    /**
     * RAG-specific progress methods
     */
    async createRAGProgress(
        sourceId: string,
        userId: string,
        totalChunks: number
    ): Promise<string> {
        return this.createProgress(
            'rag-embedding',
            sourceId,
            userId,
            'Starting document processing...',
            {
                startedAt: Date.now(),
                totalChunks,
                chunksProcessed: 0,
                embeddingsGenerated: 0,
            }
        );
    }

    async updateRAGProgress(
        progressId: string,
        chunksProcessed: number,
        embeddingsGenerated: number
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) return;

        const totalChunks = current.metadata.totalChunks || 1;
        const progress = Math.round((chunksProcessed / totalChunks) * 100);

        await this.updateProgress(progressId, {
            stage: 'embedding',
            progress,
            message: `Processing chunk ${chunksProcessed} of ${totalChunks}...`,
            metadata: {
                ...current.metadata,
                chunksProcessed,
                embeddingsGenerated,
            },
        });
    }

    /**
     * File generation progress methods
     */
    async createFileProgress(
        jobId: string,
        userId: string,
        totalFiles: number
    ): Promise<string> {
        return this.createProgress(
            'file-generation',
            jobId,
            userId,
            'Preparing file generation...',
            {
                startedAt: Date.now(),
                totalFiles,
                filesGenerated: 0,
            }
        );
    }

    async updateFileGenerationProgress(
        progressId: string,
        filesGenerated: number,
        currentFile: string
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) return;

        const totalFiles = current.metadata.totalFiles || 1;
        const progress = Math.round((filesGenerated / totalFiles) * 100);

        await this.updateProgress(progressId, {
            stage: 'generating',
            progress,
            message: `Generating ${currentFile}...`,
            metadata: {
                ...current.metadata,
                filesGenerated,
                currentFile,
            },
        });
    }

    /**
     * Private helper methods
     */
    private async saveProgress(progressId: string, progress: UnifiedProgress): Promise<void> {
        const key = this.getRedisKey(progressId);
        await this.redis.set(
            key,
            JSON.stringify(progress),
            'EX',
            this.progressTTL
        );
    }

    private broadcastProgress(progress: UnifiedProgress): void {
        if (!this.io) return;

        const rooms = this.getProgressRooms(progress);
        rooms.forEach(room => {
            this.io.to(room).emit('progress:update', progress);
        });
    }

    /**
     * Cleanup expired progress entries
     */
    async cleanup(): Promise<number> {
        const keys = await this.redis.keys('progress:*');
        let cleaned = 0;

        for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1) {
                // No expiration set, set default
                await this.redis.expire(key, this.progressTTL);
            } else if (ttl === -2) {
                // Key doesn't exist (race condition)
                cleaned++;
            }
        }

        return cleaned;
    }
}

// Create singleton instance
export const progressService = new UnifiedProgressService();

// Export helper objects for backward compatibility
export const documentProgress = {
    start: progressService.createDocumentProgress.bind(progressService),
    updateProgress: progressService.updateDocumentProgress.bind(progressService),
    updateSection: progressService.updateDocumentProgress.bind(progressService),
    complete: progressService.completeProgress.bind(progressService),
    fail: progressService.failProgress.bind(progressService),
};

export const ragProgress = {
    start: progressService.createRAGProgress.bind(progressService),
    updateChunk: progressService.updateRAGProgress.bind(progressService),
    complete: progressService.completeProgress.bind(progressService),
    fail: progressService.failProgress.bind(progressService),
};

export const fileProgress = {
    start: progressService.createFileProgress.bind(progressService),
    updateFile: progressService.updateFileGenerationProgress.bind(progressService),
    complete: progressService.completeProgress.bind(progressService),
    fail: progressService.failProgress.bind(progressService),
};

// Export factory function for testing
export function getProgressService(redisUrl?: string): UnifiedProgressService {
    return new UnifiedProgressService(redisUrl);
}