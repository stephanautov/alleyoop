// src/server/services/cache/index.ts (Updated for Prisma compatibility)

import { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { DocumentType } from '@prisma/client';
import type { CacheEntry as PrismaCacheEntry } from '@prisma/client';
import type { CacheEntry } from '@prisma/client';
import { env } from '~/env';
import { db } from '~/server/db';


// Cache configuration by document type (TTL in seconds)
export const CACHE_TTL: Record<DocumentType, number> = {
    [DocumentType.BIOGRAPHY]: 7 * 24 * 60 * 60,      // 7 days
    [DocumentType.CASE_SUMMARY]: 24 * 60 * 60,       // 1 day (legal updates)
    [DocumentType.BUSINESS_PLAN]: 3 * 24 * 60 * 60,  // 3 days
    [DocumentType.GRANT_PROPOSAL]: 7 * 24 * 60 * 60, // 7 days  
    [DocumentType.MEDICAL_REPORT]: 60 * 60,          // 1 hour (sensitive)
};

// Cache types
export enum CacheType {
    OUTLINE = 'outline',
    SECTION = 'section',
    EMBEDDING = 'embedding',
    DOCUMENT = 'document',
    GENERIC = 'generic',
}

export interface CacheOptions {
    forceRefresh?: boolean;
    ttl?: number;
    userId?: string;
}

export class CacheService {
    private redis: Redis;
    private readonly prefix = 'docuforge:cache:';

    constructor() {
        this.redis = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
    }

    /**
     * Initialize the cache service
     */
    async initialize(): Promise<void> {
        try {
            await this.redis.connect();
            console.log('Cache service initialized');
        } catch (error) {
            console.error('Failed to initialize cache service:', error);
            throw error;
        }
    }

    /**
     * Generate a cache key from input parameters
     */
    generateKey(params: {
        type: CacheType;
        documentType?: DocumentType;
        provider: string;
        model: string;
        input: any;
        section?: string;
    }): string {
        const normalizedInput = this.normalizeInput(params.input, params.documentType);
        const inputHash = this.hashInput(normalizedInput);

        const keyParts = [
            this.prefix,
            params.type,
            params.documentType || 'generic',
            params.provider,
            params.model,
            inputHash,
        ];

        if (params.section) {
            keyParts.push(params.section);
        }

        return keyParts.join(':');
    }

    /**
     * Get a cached value
     */
    async get<T = any>(
        key: string,
        options: CacheOptions = {}
    ): Promise<{ value: T; metadata: CacheEntry } | null> {
        if (options.forceRefresh) {
            return null;
        }

        try {
            // First check Redis
            const cached = await this.redis.get(key);

            if (!cached) {
                return null;
            }

            const value = JSON.parse(cached);

            // Get metadata from database
            const entry = await db.cacheEntry.findUnique({
                where: { key },
            });

            if (!entry) {
                // Redis has data but DB doesn't - shouldn't happen but handle gracefully
                return null;
            }

            // Check if expired
            if (new Date(entry.expiresAt) < new Date()) {
                await this.delete(key);
                return null;
            }

            // Update hit count and last hit time
            await db.cacheEntry.update({
                where: { key },
                data: {
                    hits: { increment: 1 },
                    lastHit: new Date(),
                },
            });

            return {
                value: value as T,
                metadata: entry,
            };
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Set a cached value
     */
    async set<T = any>(params: {
        key: string;
        value: T;
        type: CacheType;
        documentType?: DocumentType;
        provider: string;
        model: string;
        inputHash: string;
        ttl?: number;
        cost?: number;
        metadata?: Record<string, any>;
        userId?: string;
        documentId?: string;
    }): Promise<void> {
        try {
            const ttl = params.ttl ||
                (params.documentType ? CACHE_TTL[params.documentType] : 3600);

            // Store in Redis
            await this.redis.setex(
                params.key,
                ttl,
                JSON.stringify(params.value)
            );

            // Store metadata in database
            await db.cacheEntry.upsert({
                where: { key: params.key },
                create: {
                    key: params.key,
                    type: params.type,
                    value: params.value as any, // Store value in DB too for analytics
                    provider: params.provider,
                    model: params.model,
                    inputHash: params.inputHash,
                    hits: 0,
                    costSaved: params.cost || 0,
                    userId: params.userId,
                    documentType: params.documentType,
                    documentId: params.documentId,
                    expiresAt: new Date(Date.now() + ttl * 1000),
                    metadata: params.metadata,
                },
                update: {
                    value: params.value as any,
                    expiresAt: new Date(Date.now() + ttl * 1000),
                    // Don't reset hits or costSaved on update
                },
            });
        } catch (error) {
            console.error('Cache set error:', error);
            // Don't throw - caching errors shouldn't break the application
        }
    }

    /**
     * Delete a cached value
     */
    async delete(key: string): Promise<void> {
        try {
            await this.redis.del(key);
            await db.cacheEntry.delete({
                where: { key },
            }).catch(() => {
                // Ignore if doesn't exist in DB
            });
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }

    /**
     * Clear cache by pattern
     */
    async clearByPattern(pattern: string): Promise<number> {
        try {
            const keys = await this.redis.keys(`${this.prefix}${pattern}*`);

            if (keys.length === 0) {
                return 0;
            }

            // Delete from Redis
            await this.redis.del(...keys);

            // Delete from database
            await db.cacheEntry.deleteMany({
                where: {
                    key: { in: keys },
                },
            });

            return keys.length;
        } catch (error) {
            console.error('Cache clear error:', error);
            return 0;
        }
    }

    /**
     * Clear all cache for a specific document type
     */
    async clearByDocumentType(documentType: DocumentType): Promise<number> {

        if (!documentType) {
            return 0;
        }
        // Clear from Redis by pattern
        const cleared = await this.clearByPattern(`*:${documentType}:*`);

        // Also clear from database
        await db.cacheEntry.deleteMany({
            where: { documentType },
        });

        return cleared;
    }

    /**
     * Clear all cache for a specific provider
     */
    async clearByProvider(provider: string): Promise<number> {
        // Get all keys for this provider from DB
        const entries = await db.cacheEntry.findMany({
            where: { provider },
            select: { key: true },
        });

        const keys = entries.map(e => e.key);

        if (keys.length > 0) {
            // Delete from Redis
            await this.redis.del(...keys);

            // Delete from database
            await db.cacheEntry.deleteMany({
                where: { provider },
            });
        }

        return keys.length;
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        totalEntries: number;
        memoryUsage: number;
        hitRate: number;
        costSaved: number;
    }> {
        try {
            const info = await this.redis.info('memory');
            const memoryMatch = info.match(/used_memory:(\d+)/);
            const memoryUsage = parseInt(memoryMatch?.[1] ?? '0', 10);

            // Get stats from database
            const stats = await db.cacheEntry.aggregate({
                _sum: {
                    hits: true,
                    costSaved: true,
                },
                _count: {
                    _all: true,
                },
            });

            const totalHits = stats._sum.hits || 0;
            const totalRequests = await db.cacheEntry.count();
            const entriesWithHits = await db.cacheEntry.count({
                where: { hits: { gt: 0 } },
            });

            const hitRate = totalRequests > 0 ? entriesWithHits / totalRequests : 0;

            return {
                totalEntries: await this.redis.dbsize(),
                memoryUsage,
                hitRate,
                costSaved: stats._sum.costSaved || 0,
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                totalEntries: 0,
                memoryUsage: 0,
                hitRate: 0,
                costSaved: 0,
            };
        }
    }

    /**
     * Check cache health
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.redis.ping();
            return true;
        } catch (error) {
            console.error('Cache health check failed:', error);
            return false;
        }
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }

    /**
     * Normalize input for consistent hashing
     */
    private normalizeInput(input: any, documentType?: DocumentType): any {
        // Remove non-essential fields
        const {
            createdAt,
            updatedAt,
            userId,
            id,
            timestamp,
            ...essential
        } = input || {};

        // Sort arrays for consistent hashing
        if (essential.keywords && Array.isArray(essential.keywords)) {
            essential.keywords = [...essential.keywords].sort();
        }

        if (essential.focusAreas && Array.isArray(essential.focusAreas)) {
            essential.focusAreas = [...essential.focusAreas].sort();
        }

        // Normalize text fields
        if (essential.description) {
            essential.description = essential.description.toLowerCase().trim();
        }

        if (essential.subject?.name) {
            essential.subject.name = essential.subject.name.toLowerCase().trim();
        }

        // Sort object keys for consistent ordering
        return this.sortObjectKeys(essential);
    }

    /**
     * Sort object keys recursively for consistent hashing
     */
    private sortObjectKeys(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectKeys(item));
        }

        if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj)
                .sort()
                .reduce((sorted: any, key) => {
                    sorted[key] = this.sortObjectKeys(obj[key]);
                    return sorted;
                }, {});
        }

        return obj;
    }

    /**
     * Create SHA-256 hash of input
     */
    private hashInput(input: any): string {
        const jsonString = JSON.stringify(input);
        return createHash('sha256').update(jsonString).digest('hex').substring(0, 16);
    }
}

// Singleton instance
let cacheInstance: CacheService | null = null;

export function getCacheService(): CacheService {
    if (!cacheInstance) {
        cacheInstance = new CacheService();
    }
    return cacheInstance;
}