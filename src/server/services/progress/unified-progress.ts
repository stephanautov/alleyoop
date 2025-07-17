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
    }

    /**
     * Initialize Socket.IO instance
     */
    initializeSocketIO() {
        try {
            this.io = getIO();
            console.log('Socket.IO initialized for progress service');
        } catch (error) {
            console.warn('Socket.IO not initialized, progress will not be broadcast');
        }
    }

    /**
     * Create a new progress tracker
     */
    async createProgress(
        type: ProgressType,
        resourceId: string,
        userId: string,
        initialMessage: string = 'Initializing...'
    ): Promise<string> {
        const progressId = `${type}:${resourceId}`;
        const progress: UnifiedProgress = {
            type,
            resourceId,
            userId,
            stage: 'initializing',
            progress: 0,
            message: initialMessage,
            metadata: {
                startedAt: Date.now(),
            },
        };

        await this.saveProgress(progressId, progress);
        this.broadcastProgress(progress);
        this.emit('progress:created', progress);

        return progressId;
    }

    /**
     * Update progress with partial data
     */
    async updateProgress(
        progressId: string,
        update: Partial<Omit<UnifiedProgress, 'type' | 'resourceId' | 'userId'>>
    ): Promise<void> {
        const current = await this.getProgressById(progressId);
        if (!current) {
            throw new Error(`Progress not found: ${progressId}`);
        }

        const updated: UnifiedProgress = {
            ...current,
            ...update,
            metadata: {
                ...current.metadata,
                ...update.metadata,
            },
        };

        // Calculate estimated time remaining
        if (updated.progress > 0 && updated.progress < 100) {
            const elapsed = Date.now() - updated.metadata.startedAt;
            const rate = updated.progress / elapsed;
            const remaining = (100 - updated.progress) / rate;
            updated.metadata.estimatedTimeRemaining = Math.round(remaining);
        }

        // Validate the updated progress
        const validated = UnifiedProgressSchema.parse(updated);

        await this.saveProgress(progressId, validated);
        this.broadcastProgress(validated);
        this.emit('progress:updated', validated);
    }

    /**
     * Update progress with full UnifiedProgress object (for backward compatibility)
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
     * Complete progress
     */
    async completeProgress(
        progressId: string,
        message: string = 'Completed successfully'
    ): Promise<void> {
        await this.updateProgress(progressId, {
            stage: 'completed',
            progress: 100,
            message,
            metadata: {
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
    async getProgress(type: ProgressType, resourceId: string): Promise<UnifiedProgress | null> {
        const progressId = `${type}:${resourceId}`;
        return this.getProgressById(progressId);
    }

    /**
     * Get all active progress for a user
     */
    async getUserProgress(userId: string): Promise<UnifiedProgress[]> {
        const pattern = `progress:*`;
        const keys = await this.redis.keys(pattern);

        const progress: UnifiedProgress[] = [];

        for (const key of keys) {
            const data = await this.redis.get(key);
            if (data) {
                try {
                    const parsed = UnifiedProgressSchema.parse(JSON.parse(data));
                    if (parsed.userId === userId) {
                        progress.push(parsed);
                    }
                } catch (error) {
                    // Skip invalid entries
                }
            }
        }

        return progress.sort((a, b) => b.metadata.startedAt - a.metadata.startedAt);
    }

    /**
     * Subscribe to progress updates for a resource
     */
    subscribeToProgress(
        type: ProgressType,
        resourceId: string,
        callback: (progress: UnifiedProgress) => void
    ): () => void {
        const handler = (progress: UnifiedProgress) => {
            if (progress.type === type && progress.resourceId === resourceId) {
                callback(progress);
            }
        };

        this.on('progress', handler);
        this.on('progress:updated', handler);

        // Return unsubscribe function
        return () => {
            this.off('progress', handler);
            this.off('progress:updated', handler);
        };
    }

    /**
     * Subscribe socket to progress updates
     */
    subscribeSocket(
        progressId: string,
        userId: string,
        socketId: string
    ): void {
        if (!this.io) return;

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) return;

        const [type, resourceId] = progressId.split(':');
        const room = `${type}:${resourceId}`;

        socket.join(room);
        console.log(`Socket ${socketId} subscribed to progress ${progressId}`);

        // Send current progress immediately
        this.getProgressById(progressId).then(progress => {
            if (progress && progress.userId === userId) {
                socket.emit('progress:update', progress);
            }
        });
    }

    /**
     * Unsubscribe socket from progress updates
     */
    unsubscribeSocket(progressId: string, socketId: string): void {
        if (!this.io) return;

        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) return;

        const [type, resourceId] = progressId.split(':');
        const room = `${type}:${resourceId}`;

        socket.leave(room);
        console.log(`Socket ${socketId} unsubscribed from progress ${progressId}`);
    }

    /**
     * Clear progress for a resource
     */
    async clearProgress(type: ProgressType, resourceId: string): Promise<void> {
        const key = this.getProgressKey(type, resourceId);
        await this.redis.del(key);
    }

    /**
     * Create specialized progress trackers
     */
    async createDocumentProgress(
        documentId: string,
        userId: string,
        provider: string,
        model: string
    ): Promise<string> {
        const progressId = await this.createProgress(
            'document-generation',
            documentId,
            userId,
            'Preparing document generation...'
        );

        await this.updateProgress(progressId, {
            metadata: {
                provider,
                model,
            },
        });

        return progressId;
    }

    async createRAGProgress(
        sourceId: string,
        userId: string,
        totalChunks: number
    ): Promise<string> {
        const progressId = await this.createProgress(
            'rag-embedding',
            sourceId,
            userId,
            'Processing document for embedding...'
        );

        await this.updateProgress(progressId, {
            metadata: {
                totalChunks,
                chunksProcessed: 0,
                embeddingsGenerated: 0,
            },
        });

        return progressId;
    }

    async createFileGenerationProgress(
        sessionId: string,
        userId: string,
        totalFiles: number
    ): Promise<string> {
        const progressId = await this.createProgress(
            'file-generation',
            sessionId,
            userId,
            'Generating files...'
        );

        await this.updateProgress(progressId, {
            metadata: {
                totalFiles,
                filesGenerated: 0,
            },
        });

        return progressId;
    }

    /**
     * Progress update helpers for specific operations
     */
    async updateDocumentProgress(
        progressId: string,
        stage: 'outline' | 'sections' | 'refinement',
        progress: number,
        currentSection?: string
    ): Promise<void> {
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
                currentSection,
            },
        });
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
                chunksProcessed,
                embeddingsGenerated,
            },
        });
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

    private getProgressRooms(progress: UnifiedProgress): string[] {
        return [
            `user:${progress.userId}`,
            `${progress.type}:${progress.resourceId}`,
        ];
    }

    private getRedisKey(progressId: string): string {
        return `progress:${progressId}`;
    }

    private getProgressKey(type: ProgressType, resourceId: string): string {
        return `progress:${type}:${resourceId}`;
    }

    /**
     * Cleanup old progress entries
     */
    async cleanupOldProgress(): Promise<void> {
        const pattern = 'progress:*';
        const keys = await this.redis.keys(pattern);

        let cleaned = 0;
        for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1) {
                // No expiry set, check age
                const data = await this.redis.get(key);
                if (data) {
                    try {
                        const progress = JSON.parse(data);
                        const age = Date.now() - (progress.metadata?.startedAt || 0);
                        if (age > 24 * 60 * 60 * 1000) { // 24 hours
                            await this.redis.del(key);
                            cleaned++;
                        }
                    } catch {
                        // Delete invalid entries
                        await this.redis.del(key);
                        cleaned++;
                    }
                }
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} old progress entries`);
        }
    }
}

// Export singleton instance
let progressService: UnifiedProgressService;

export function getProgressService(): UnifiedProgressService {
    if (!progressService) {
        progressService = new UnifiedProgressService();
        progressService.initializeSocketIO();

        // Cleanup old progress entries periodically
        setInterval(() => {
            progressService.cleanupOldProgress().catch(console.error);
        }, 60 * 60 * 1000); // Every hour
    }

    return progressService;
}

// Export for backward compatibility
export const progressService = getProgressService();

// Helper functions for specific progress types (backward compatible)
export const documentProgress = {
    start: (documentId: string, userId: string) => {
        const service = getProgressService();
        return service.setProgress({
            type: 'document-generation',
            resourceId: documentId,
            userId,
            stage: 'initializing',
            progress: 0,
            message: 'Starting document generation...',
            metadata: { startedAt: Date.now() },
        });
    },

    updateSection: (documentId: string, userId: string, section: string, progress: number) => {
        const service = getProgressService();
        return service.setProgress({
            type: 'document-generation',
            resourceId: documentId,
            userId,
            stage: 'sections',
            progress,
            message: `Generating ${section}...`,
            metadata: {
                currentSection: section,
                startedAt: Date.now(),
            },
        });
    },
};

export const ragProgress = {
    start: (sourceId: string, userId: string, totalChunks: number) => {
        const service = getProgressService();
        return service.setProgress({
            type: 'rag-embedding',
            resourceId: sourceId,
            userId,
            stage: 'processing',
            progress: 0,
            message: 'Processing document...',
            metadata: {
                totalChunks,
                chunksProcessed: 0,
                startedAt: Date.now(),
            },
        });
    },

    updateChunk: (sourceId: string, userId: string, chunksProcessed: number, totalChunks: number) => {
        const service = getProgressService();
        return service.setProgress({
            type: 'rag-embedding',
            resourceId: sourceId,
            userId,
            stage: 'embedding',
            progress: Math.round((chunksProcessed / totalChunks) * 100),
            message: `Processing chunk ${chunksProcessed} of ${totalChunks}...`,
            metadata: {
                chunksProcessed,
                totalChunks,
                startedAt: Date.now(),
            },
        });
    },
};