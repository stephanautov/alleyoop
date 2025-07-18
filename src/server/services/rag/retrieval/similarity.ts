// File: src/server/services/rag/retrieval/similarity.ts
// ============================================

import { BaseVectorStore } from "../vectorstore/base";
import { EmbeddingService } from "../embeddings";
import type { SearchResult, RetrievalOptions } from "../types";

export class SimilaritySearch {
    constructor(
        private vectorStore: BaseVectorStore,
        private embeddingService: EmbeddingService
    ) { }

    /**
     * Perform basic similarity search
     */
    async search(
        query: string,
        options: RetrievalOptions = {}
    ): Promise<SearchResult[]> {
        // Generate query embedding
        const queryEmbedding = await this.embeddingService.embedQuery(query);

        // Search in vector store
        return this.vectorStore.search(queryEmbedding, options);
    }

    /**
     * Perform multi-query search for better recall
     */
    async multiQuerySearch(
        queries: string[],
        options: RetrievalOptions = {}
    ): Promise<SearchResult[]> {
        const allResults: SearchResult[] = [];
        const seenIds = new Set<string>();

        // Search with each query
        for (const query of queries) {
            const results = await this.search(query, {
                ...options,
                limit: options.limit || 5,
            });

            // Deduplicate results
            for (const result of results) {
                if (!seenIds.has(result.id)) {
                    seenIds.add(result.id);
                    allResults.push(result);
                }
            }
        }

        // Sort by similarity and return top results
        return allResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, options.limit || 5);
    }

    /**
     * Search with query expansion
     */
    async expandedSearch(
        query: string,
        expansionTerms: string[],
        options: RetrievalOptions = {}
    ): Promise<SearchResult[]> {
        // Combine original query with expansion terms
        const expandedQuery = `${query} ${expansionTerms.join(' ')}`;

        // Perform search with expanded query
        const expandedResults = await this.search(expandedQuery, {
            ...options,
            limit: (options.limit || 5) * 2,
        });

        // Also search with original query
        const originalResults = await this.search(query, {
            ...options,
            limit: options.limit || 5,
        });

        // Merge and deduplicate
        const resultMap = new Map<string, SearchResult>();

        // Add original results with boost
        for (const result of originalResults) {
            resultMap.set(result.id, {
                ...result,
                similarity: result.similarity * 1.2, // Boost original query matches
            });
        }

        // Add expanded results
        for (const result of expandedResults) {
            if (!resultMap.has(result.id)) {
                resultMap.set(result.id, result);
            }
        }

        // Sort and return top results
        return Array.from(resultMap.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, options.limit || 5);
    }
}