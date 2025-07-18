// File: src/server/services/rag/retrieval/reranker.ts
// ============================================

import { OpenAI } from "openai";
import { SearchResult } from "../types";
import { env } from "~/env";

export interface RerankOptions {
    model?: string;
    topK?: number;
    includeScore?: boolean;
}

export class Reranker {
    private openai: OpenAI;

    constructor(apiKey?: string) {
        this.openai = new OpenAI({
            apiKey: apiKey || env.OPENAI_API_KEY,
        });
    }

    /**
     * Rerank results using cross-encoder approach with GPT
     */
    async rerankWithGPT(
        query: string,
        results: SearchResult[],
        options: RerankOptions = {}
    ): Promise<SearchResult[]> {
        const { model = 'gpt-3.5-turbo', topK = 5 } = options;

        if (results.length === 0) return [];

        try {
            // Create reranking prompt
            const prompt = this.buildRerankingPrompt(query, results);

            const response = await this.openai.chat.completions.create({
                model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a relevance ranker. Given a query and a list of passages, rank them by relevance to the query. Return only the indices in order of relevance, separated by commas.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0,
                max_tokens: 100,
            });

            const content = response.choices[0]?.message?.content || '';
            const indices = content
                .split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n < results.length);

            // Reorder results based on GPT ranking
            const rerankedResults = indices
                .slice(0, topK)
                .map((index, position) => ({
                    ...results[index],
                    similarity: 1 - (position / topK), // Adjust similarity based on rank
                }));

            // Add any missing results if GPT didn't rank all
            if (rerankedResults.length < topK) {
                const usedIndices = new Set(indices);
                const remaining = results
                    .filter((_, index) => !usedIndices.has(index))
                    .slice(0, topK - rerankedResults.length);
                rerankedResults.push(...remaining);
            }

            return rerankedResults;
        } catch (error) {
            console.error('GPT reranking failed:', error);
            // Fallback to original order
            return results.slice(0, topK);
        }
    }

    /**
     * Rerank using a simpler scoring approach
     */
    async rerankWithScoring(
        query: string,
        results: SearchResult[],
        options: RerankOptions = {}
    ): Promise<SearchResult[]> {
        const { topK = 5 } = options;

        // Score each result based on multiple factors
        const scoredResults = results.map(result => {
            let score = result.similarity;

            // Boost exact matches
            const queryLower = query.toLowerCase();
            const contentLower = result.content.toLowerCase();
            if (contentLower.includes(queryLower)) {
                score *= 1.5;
            }

            // Boost query term coverage
            const queryTerms = queryLower.split(/\s+/);
            const matchedTerms = queryTerms.filter(term =>
                contentLower.includes(term)
            ).length;
            score *= (1 + matchedTerms / queryTerms.length);

            // Consider metadata signals
            if (result.metadata?.importance === 'high') {
                score *= 1.2;
            }
            if (result.metadata?.recency) {
                const daysOld = Math.floor(
                    (Date.now() - new Date(result.metadata.recency).getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                score *= Math.max(0.5, 1 - daysOld / 365); // Decay over a year
            }

            return { ...result, similarity: Math.min(score, 1) };
        });

        // Sort by score and return top K
        return scoredResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    private buildRerankingPrompt(
        query: string,
        results: SearchResult[]
    ): string {
        const passages = results
            .map((result, index) =>
                `[${index}] ${result.content.substring(0, 200)}...`
            )
            .join('\n\n');

        return `Query: "${query}"

Passages:
${passages}

Rank the passages by relevance to the query. Return only the indices in order, separated by commas.`;
    }
}