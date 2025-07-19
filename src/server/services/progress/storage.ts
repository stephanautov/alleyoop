// src/server/services/progress/storage.ts

import { Redis } from 'ioredis';
import { env } from '~/env';

export interface ProgressData {
    documentId: string;
    stage: 'outline' | 'sections' | 'refinement' | 'complete' | 'error';
    progress: number;
    message: string;
    currentSection?: string;
    estimatedTimeRemaining?: number;
    error?: string;
    canRetry?: boolean;
    updatedAt: number;
    startedAt: number;
}

export class ProgressStorageService {
    private redis: Redis;
    private readonly TTL = 3600; // 1 hour

    constructor() {
        this.redis = new Redis(env.REDIS_URL);
    }

    async saveProgress(data: ProgressData): Promise<void> {
        const key = `progress:document:${data.documentId}`;
        await this.redis.setex(key, this.TTL, JSON.stringify(data));
    }

    async getProgress(documentId: string): Promise<ProgressData | null> {
        const key = `progress:document:${documentId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async deleteProgress(documentId: string): Promise<void> {
        const key = `progress:document:${documentId}`;
        await this.redis.del(key);
    }

    async updateEstimatedTime(documentId: string, estimatedTimeRemaining: number): Promise<void> {
        const progress = await this.getProgress(documentId);
        if (progress) {
            progress.estimatedTimeRemaining = estimatedTimeRemaining;
            progress.updatedAt = Date.now();
            await this.saveProgress(progress);
        }
    }
}