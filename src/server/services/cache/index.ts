// src/server/services/cache/index.ts

import { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { z } from 'zod';
import { DocumentType } from '@prisma/client';
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
}

// Cache entry schema
const cacheEntrySchema = z.object({
    key: z.string(),
    type: z.nativeEnum(CacheType),
    provider: z.string(),
    model: z.string(),
    value: z.any(),
    inputHash: z.string(),
    documentType: z.nativeEnum(DocumentType).optional(),
    hits: z.number().default(0),
    lastHit: z.string().optional(),
    costSaved: z.number().default(0),
    createdAt: z.string(),
    expiresAt: z.string(),
    metadata: z.record(z.any()).optional(),
});

export type CacheEntry = z.infer<typeof cacheEntrySchema>;

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
            const cached = await this.redis.get(key);

            if (!cached) {
                return null;
            }

            const entry = cacheEntrySchema.parse(JSON.parse(cached));

            // Check if expired
            if (new Date(entry.expiresAt) < new Date()) {
                await this.delete(key);
                return null;
            }

            // Update hit count and last hit time
            entry.hits += 1;
            entry.lastHit = new Date().toISOString();

            // Update in Redis
            await this.redis.set(key, JSON.stringify(entry));

            // Track hit in database if we have enough information
            if (entry.metadata?.documentId) {
                await this.trackCacheHit(entry);
            }

            return {
                value: entry.value as T,
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
    }): Promise<void> {
        try {
            const ttl = params.ttl ||
                (params.documentType ? CACHE_TTL[params.documentType] : 3600);

            const entry: CacheEntry = {
                key: params.key,
                type: params.type,
                provider: params.provider,
                model: params.model,
                value: params.value,
                inputHash: params.inputHash,
                documentType: params.documentType,
                hits: 0,
                costSaved: params.cost || 0,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
                metadata: params.metadata,
            };

            await this.redis.setex(
                params.key,
                ttl,
                JSON.stringify(entry)
            );

            // Store in database for analytics
            await this.saveCacheEntry(entry);
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

            await this.redis.del(...keys);
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
        return this.clearByPattern(`*:${documentType}:*`);
    }

    /**
     * Clear all cache for a specific provider
     */
    async clearByProvider(provider: string): Promise<number> {
        return this.clearByPattern(`*:${provider}:*`);
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
            const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;

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
            const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

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
     * Save cache entry to database for analytics
     */
    private async saveCacheEntry(entry: CacheEntry): Promise<void> {
        try {
            await db.cacheEntry.create({
                data: {
                    key: entry.key,
                    type: entry.type,
                    provider: entry.provider,
                    model: entry.model,
                    value: entry.value,
                    inputHash: entry.inputHash,
                    expiresAt: new Date(entry.expiresAt),
                    metadata: entry.metadata,
                },
            });
        } catch (error) {
            // Log but don't throw - database tracking is secondary
            console.error('Failed to save cache entry to database:', error);
        }
    }

    /**
     * Track cache hit in database
     */
    private async trackCacheHit(entry: CacheEntry): Promise<void> {
        try {
            await db.cacheEntry.updateMany({
                where: { key: entry.key },
                data: {
                    hits: { increment: 1 },
                    lastHit: new Date(),
                    costSaved: { increment: entry.costSaved },
                },
            });
        } catch (error) {
            console.error('Failed to track cache hit:', error);
        }
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