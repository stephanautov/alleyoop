// File: src/server/services/rag/retrieval/hybrid.ts
// ============================================

import { PrismaClient } from "@prisma/client";
import { BaseVectorStore } from "../vectorstore/base";
import { EmbeddingService } from "../embeddings";
import type { SearchResult, RetrievalOptions } from "../types";

export class HybridSearch {
    constructor(
        private prisma: PrismaClient,
        private vectorStore: BaseVectorStore,
        private embeddingService: EmbeddingService
    ) { }

    /**
     * Perform hybrid search combining vector similarity and keyword search
     */
    async search(
        query: string,
        options: RetrievalOptions = {}
    ): Promise<SearchResult[]> {
        const { limit = 5, sourceIds, userId } = options;

        // Perform both searches in parallel
        const [vectorResults, keywordResults] = await Promise.all([
            this.vectorSearch(query, options),
            this.keywordSearch(query, options),
        ]);

        // Combine and score results
        return this.fuseResults(vectorResults, keywordResults, limit);
    }

    /**
     * Vector similarity search
     */
    private async vectorSearch(
        query: string,
        options: RetrievalOptions
    ): Promise<SearchResult[]> {
        const queryEmbedding = await this.embeddingService.embedQuery(query);
        return this.vectorStore.search(queryEmbedding, {
            ...options,
            limit: (options.limit || 5) * 2, // Get more for fusion
        });
    }

    /**
     * Full-text keyword search using PostgreSQL
     */
    private async keywordSearch(
        query: string,
        options: RetrievalOptions
    ): Promise<SearchResult[]> {
        const { limit = 5, sourceIds, userId } = options;

        // Build WHERE conditions
        const conditions: any = {};

        if (sourceIds && sourceIds.length > 0) {
            conditions.sourceId = { in: sourceIds };
        }

        // Perform full-text search
        const results = await this.prisma.embedding.findMany({
            where: {
                ...conditions,
                content: {
                    search: query.split(' ').join(' & '), // PostgreSQL full-text search
                },
                source: userId ? { userId } : undefined,
            },
            include: {
                source: {
                    select: {
                        name: true,
                        type: true,
                    },
                },
            },
            take: limit * 2,
        });

        // Calculate BM25-like scores
        return results.map(result => {
            const score = this.calculateBM25Score(result.content, query);
            return {
                id: result.id,
                content: result.content,
                similarity: score,
                metadata: result.metadata as Record<string, any>,
                sourceId: result.sourceId!,
                sourceName: result.source?.name || 'Unknown',
            };
        });
    }

    /**
     * Simple BM25 scoring implementation
     */
    private calculateBM25Score(
        content: string,
        query: string,
        k1: number = 1.2,
        b: number = 0.75
    ): number {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const contentTerms = content.toLowerCase().split(/\s+/);
        const contentLength = contentTerms.length;
        const avgDocLength = 300; // Approximate average

        let score = 0;

        for (const term of queryTerms) {
            const termFreq = contentTerms.filter(t => t === term).length;
            if (termFreq > 0) {
                const idf = Math.log(1 + (1000 - 1 + 0.5) / (1 + 0.5)); // Simplified IDF
                const tf = (termFreq * (k1 + 1)) /
                    (termFreq + k1 * (1 - b + b * (contentLength / avgDocLength)));
                score += idf * tf;
            }
        }

        // Normalize to 0-1 range
        return Math.min(score / queryTerms.length / 3, 1);
    }

    /**
     * Fuse vector and keyword results using reciprocal rank fusion
     */
    private fuseResults(
        vectorResults: SearchResult[],
        keywordResults: SearchResult[],
        limit: number
    ): SearchResult[] {
        const k = 60; // Fusion constant
        const fusedScores = new Map<string, number>();
        const resultMap = new Map<string, SearchResult>();

        // Add vector results with ranks
        vectorResults.forEach((result, index) => {
            const score = 1 / (k + index + 1);
            fusedScores.set(result.id, score);
            resultMap.set(result.id, result);
        });

        // Add keyword results with ranks
        keywordResults.forEach((result, index) => {
            const score = 1 / (k + index + 1);
            const existingScore = fusedScores.get(result.id) || 0;
            fusedScores.set(result.id, existingScore + score);

            if (!resultMap.has(result.id)) {
                resultMap.set(result.id, result);
            }
        });

        // Sort by fused score and return top results
        return Array.from(fusedScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id, fusedScore]) => {
                const result = resultMap.get(id)!;
                return {
                    ...result,
                    similarity: fusedScore, // Use fused score as similarity
                };
            });
    }
}