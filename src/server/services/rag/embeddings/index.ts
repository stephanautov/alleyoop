// File: src/server/services/rag/embeddings/index.ts
// ============================================

import { OpenAI } from "openai";
import { encode } from "gpt-3-encoder";
import { env } from "~/env";

export interface EmbeddingOptions {
    model?: string;
    dimensions?: number;
}

export interface TextChunk {
    content: string;
    metadata?: Record<string, any>;
    index: number;
}

export class EmbeddingService {
    private openai: OpenAI;
    private model: string;
    private dimensions?: number;

    constructor(options: EmbeddingOptions = {}) {
        this.openai = new OpenAI({
            apiKey: env.OPENAI_API_KEY,
        });
        this.model = options.model || "text-embedding-3-small";
        this.dimensions = options.dimensions;
    }

    /**
     * Generate embeddings for text chunks
     */
    async embedChunks(chunks: TextChunk[]): Promise<Array<{
        chunk: TextChunk;
        embedding: number[];
        tokenCount: number;
    }>> {
        const results = [];

        // Process in batches to avoid rate limits
        const batchSize = 20;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(chunk => chunk.content);

            try {
                const response = await this.openai.embeddings.create({
                    model: this.model,
                    input: texts,
                    dimensions: this.dimensions,
                });

                for (let j = 0; j < batch.length; j++) {
                    const chunk = batch[j];
                    const embedding = response.data[j].embedding;
                    const tokenCount = encode(chunk.content).length;

                    results.push({
                        chunk,
                        embedding,
                        tokenCount,
                    });
                }
            } catch (error) {
                console.error("Embedding error:", error);
                throw new Error(`Failed to generate embeddings: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Generate a single embedding for a query
     */
    async embedQuery(query: string): Promise<number[]> {
        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: query,
                dimensions: this.dimensions,
            });

            return response.data[0].embedding;
        } catch (error) {
            console.error("Query embedding error:", error);
            throw new Error(`Failed to embed query: ${error.message}`);
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error("Vectors must have the same length");
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }
}