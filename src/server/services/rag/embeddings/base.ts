// File: src/server/services/rag/embeddings/base.ts
// ============================================

import type { EmbeddingResult, TextChunk, ChunkWithEmbedding } from '../types';

export abstract class BaseEmbeddingService {
    protected model: string;
    protected dimension: number;

    constructor(model: string, dimension: number) {
        this.model = model;
        this.dimension = dimension;
    }

    /**
     * Generate embedding for a single text
     */
    abstract embedText(text: string): Promise<EmbeddingResult>;

    /**
     * Generate embeddings for multiple texts
     */
    abstract embedBatch(texts: string[]): Promise<EmbeddingResult[]>;

    /**
     * Generate embedding for a query (may use different model/params)
     */
    async embedQuery(query: string): Promise<number[]> {
        const result = await this.embedText(query);
        return result.embedding;
    }

    /**
     * Generate embeddings for chunks
     */
    async embedChunks(chunks: TextChunk[]): Promise<ChunkWithEmbedding[]> {
        const texts = chunks.map(chunk => chunk.content);
        const embeddings = await this.embedBatch(texts);

        // Ensure we have embeddings for all chunks
        if (embeddings.length !== chunks.length) {
            throw new Error(
                `Embedding batch size mismatch: expected ${chunks.length}, got ${embeddings.length}`
            );
        }

        return chunks.map((chunk, index) => {
            const embedding = embeddings[index];
            if (!embedding) {
                throw new Error(`Missing embedding for chunk at index ${index}`);
            }

            return {
                ...chunk,
                embedding: embedding.embedding,
                tokenCount: embedding.tokenCount,
            };
        });
    }

    /**
     * Count tokens in text
     */
    abstract countTokens(text: string): number;

    /**
     * Get the model name
     */
    getModel(): string {
        return this.model;
    }

    /**
     * Get the embedding dimension
     */
    getDimension(): number {
        return this.dimension;
    }
}