// src/server/services/cache/manager.ts

import { DocumentType } from '@prisma/client';
import { CacheService, CacheType, type CacheOptions } from './index';
import { getCacheService } from './index';
import type { DocumentProviderName } from '../document/types';

export interface OutlineCacheParams {
    documentType: DocumentType;
    input: any;
    provider: DocumentProviderName;
    model: string;
    userId?: string;
}

export interface SectionCacheParams extends OutlineCacheParams {
    sectionId: string;
    outline?: any;
    previousSections?: Record<string, string>;
}

export interface EmbeddingCacheParams {
    documentId: string;
    chunkIndex: number;
    chunkText: string;
    embeddingModel: string;
}

export class CacheManager {
    private cache: CacheService;

    constructor() {
        this.cache = getCacheService();
    }

    /**
     * Get or generate document outline
     */
    async getOrGenerateOutline<T = any>(
        params: OutlineCacheParams,
        generator: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<{ value: T; fromCache: boolean; costSaved?: number }> {
        const key = this.cache.generateKey({
            type: CacheType.OUTLINE,
            documentType: params.documentType,
            provider: params.provider,
            model: params.model,
            input: params.input,
        });

        // Try to get from cache
        const cached = await this.cache.get<T>(key, options);

        if (cached) {
            console.log(`Cache hit for outline: ${params.documentType}`);
            return {
                value: cached.value,
                fromCache: true,
                costSaved: cached.metadata.costSaved,
            };
        }

        // Generate if not cached
        console.log(`Cache miss for outline: ${params.documentType}`);
        const value = await generator();

        // Estimate cost based on typical outline generation
        const estimatedCost = this.estimateOutlineCost(params.provider, params.model);

        // Cache the result
        await this.cache.set({
            key,
            value,
            type: CacheType.OUTLINE,
            documentType: params.documentType,
            provider: params.provider,
            model: params.model,
            inputHash: key.split(':').pop()!,
            cost: estimatedCost,
            metadata: {
                userId: params.userId,
                documentType: params.documentType,
            },
        });

        return {
            value,
            fromCache: false,
        };
    }

    /**
     * Get or generate document section
     */
    async getOrGenerateSection<T = any>(
        params: SectionCacheParams,
        generator: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<{ value: T; fromCache: boolean; costSaved?: number }> {
        const key = this.cache.generateKey({
            type: CacheType.SECTION,
            documentType: params.documentType,
            provider: params.provider,
            model: params.model,
            input: {
                ...params.input,
                sectionId: params.sectionId,
                outlineHash: params.outline ? this.hashObject(params.outline) : null,
            },
            section: params.sectionId,
        });

        // Try to get from cache
        const cached = await this.cache.get<T>(key, options);

        if (cached) {
            console.log(`Cache hit for section: ${params.sectionId}`);
            return {
                value: cached.value,
                fromCache: true,
                costSaved: cached.metadata.costSaved,
            };
        }

        // Generate if not cached
        console.log(`Cache miss for section: ${params.sectionId}`);
        const value = await generator();

        // Estimate cost based on typical section generation
        const estimatedCost = this.estimateSectionCost(params.provider, params.model);

        // Cache the result
        await this.cache.set({
            key,
            value,
            type: CacheType.SECTION,
            documentType: params.documentType,
            provider: params.provider,
            model: params.model,
            inputHash: key.split(':').pop()!,
            cost: estimatedCost,
            metadata: {
                userId: params.userId,
                documentType: params.documentType,
                sectionId: params.sectionId,
            },
        });

        return {
            value,
            fromCache: false,
        };
    }

    /**
     * Get or generate embedding
     */
    async getOrGenerateEmbedding(
        params: EmbeddingCacheParams,
        generator: () => Promise<number[]>,
        options: CacheOptions = {}
    ): Promise<{ value: number[]; fromCache: boolean }> {
        const key = this.cache.generateKey({
            type: CacheType.EMBEDDING,
            provider: 'openai',
            model: params.embeddingModel,
            input: {
                documentId: params.documentId,
                chunkIndex: params.chunkIndex,
                chunkHash: this.hashText(params.chunkText),
            },
        });

        // Try to get from cache
        const cached = await this.cache.get<number[]>(key, options);

        if (cached) {
            console.log(`Cache hit for embedding: doc=${params.documentId}, chunk=${params.chunkIndex}`);
            return {
                value: cached.value,
                fromCache: true,
            };
        }

        // Generate if not cached
        console.log(`Cache miss for embedding: doc=${params.documentId}, chunk=${params.chunkIndex}`);
        const value = await generator();

        // Cache embeddings with long TTL (30 days)
        await this.cache.set({
            key,
            value,
            type: CacheType.EMBEDDING,
            provider: 'openai',
            model: params.embeddingModel,
            inputHash: key.split(':').pop()!,
            ttl: 30 * 24 * 60 * 60,
            metadata: {
                documentId: params.documentId,
                chunkIndex: params.chunkIndex,
            },
        });

        return {
            value,
            fromCache: false,
        };
    }

    /**
     * Invalidate cache for a document
     */
    async invalidateDocument(documentId: string): Promise<void> {
        // Clear any cached content related to this document
        await this.cache.clearByPattern(`*:${documentId}:*`);
    }

    /**
     * Invalidate cache for a document type
     */
    async invalidateDocumentType(documentType: DocumentType): Promise<void> {
        await this.cache.clearByDocumentType(documentType);
    }

    /**
     * Get cache statistics for a user
     */
    async getUserCacheStats(userId: string): Promise<{
        totalHits: number;
        costSaved: number;
        cacheRate: number;
    }> {
        // This would query the database for user-specific stats
        // For now, return overall stats
        const stats = await this.cache.getStats();

        return {
            totalHits: Math.floor(stats.hitRate * 100),
            costSaved: stats.costSaved,
            cacheRate: stats.hitRate,
        };
    }

    /**
     * Warm cache with common patterns
     */
    async warmCache(documentType: DocumentType, patterns: any[]): Promise<void> {
        console.log(`Warming cache for ${documentType} with ${patterns.length} patterns`);

        // This would be called by a background job to pre-generate
        // common outlines and sections

        // Implementation would depend on specific warming strategy
    }

    /**
     * Check if content should be cached
     */
    shouldCache(params: {
        documentType: DocumentType;
        hasPersonalInfo: boolean;
        isTemplate: boolean;
    }): boolean {
        // Don't cache medical reports with personal info
        if (params.documentType === DocumentType.MEDICAL_REPORT && params.hasPersonalInfo) {
            return false;
        }

        // Always cache templates
        if (params.isTemplate) {
            return true;
        }

        // Cache other document types
        return true;
    }

    /**
     * Estimate costs for different operations
     */
    private estimateOutlineCost(provider: DocumentProviderName, model: string): number {
        const costs: Record<string, Record<string, number>> = {
            openai: {
                'gpt-4': 0.12,
                'gpt-4-turbo': 0.10,
                'gpt-3.5-turbo': 0.02,
            },
            anthropic: {
                'claude-3-opus': 0.15,
                'claude-3-sonnet': 0.08,
                'claude-3-haiku': 0.03,
            },
            gemini: {
                'gemini-1.5-pro': 0.07,
                'gemini-1.5-flash': 0.02,
            },
            perplexity: {
                'pplx-70b': 0.05,
                'pplx-7b': 0.01,
            },
            llama: {
                'llama-3-70b': 0.04,
                'llama-3-8b': 0.01,
            },
        };

        return costs[provider]?.[model] || 0.05;
    }

    private estimateSectionCost(provider: DocumentProviderName, model: string): number {
        // Sections typically cost 2-3x more than outlines
        return this.estimateOutlineCost(provider, model) * 2.5;
    }

    private hashObject(obj: any): string {
        return require('crypto')
            .createHash('sha256')
            .update(JSON.stringify(obj))
            .digest('hex')
            .substring(0, 8);
    }

    private hashText(text: string): string {
        return require('crypto')
            .createHash('sha256')
            .update(text)
            .digest('hex')
            .substring(0, 8);
    }
}

// Export singleton instance
let managerInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
    if (!managerInstance) {
        managerInstance = new CacheManager();
    }
    return managerInstance;
}