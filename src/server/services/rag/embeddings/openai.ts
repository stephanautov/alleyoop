// File: src/server/services/rag/embeddings/openai.ts
// ============================================

import { OpenAI } from "openai";
import { encoding_for_model, type TiktokenModel } from "tiktoken";
import { BaseEmbeddingService } from "./base";
import { EmbeddingResult } from "../types";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";

export class OpenAIEmbeddingService extends BaseEmbeddingService {
    private openai: OpenAI;
    private encoder: any;
    private maxBatchSize = 100;
    private maxInputTokens = 8191; // text-embedding-3-small limit

    constructor(
        apiKey?: string,
        model: string = "text-embedding-3-small",
        dimension: number = 1536
    ) {
        super(model, dimension);

        this.openai = new OpenAI({
            apiKey: apiKey || env.OPENAI_API_KEY,
        });

        // Initialize tokenizer
        try {
            this.encoder = encoding_for_model("text-embedding-ada-002" as TiktokenModel);
        } catch {
            // Fallback for newer models
            this.encoder = encoding_for_model("gpt-3.5-turbo" as TiktokenModel);
        }
    }

    async embedText(text: string): Promise<EmbeddingResult> {
        try {
            // Truncate if too long
            const truncatedText = this.truncateToTokenLimit(text);

            const response = await this.openai.embeddings.create({
                model: this.model,
                input: truncatedText,
                dimensions: this.dimension < 1536 ? this.dimension : undefined,
            });

            return {
                embedding: response.data[0].embedding,
                tokenCount: this.countTokens(truncatedText),
            };
        } catch (error: any) {
            console.error("OpenAI embedding error:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to generate embedding: ${error.message}`,
            });
        }
    }

    async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        const results: EmbeddingResult[] = [];

        // Process in batches
        for (let i = 0; i < texts.length; i += this.maxBatchSize) {
            const batch = texts.slice(i, i + this.maxBatchSize);
            const truncatedBatch = batch.map(text => this.truncateToTokenLimit(text));

            try {
                const response = await this.openai.embeddings.create({
                    model: this.model,
                    input: truncatedBatch,
                    dimensions: this.dimension < 1536 ? this.dimension : undefined,
                });

                for (let j = 0; j < response.data.length; j++) {
                    results.push({
                        embedding: response.data[j].embedding,
                        tokenCount: this.countTokens(truncatedBatch[j]),
                    });
                }
            } catch (error: any) {
                console.error(`Batch embedding error at index ${i}:`, error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `Failed to generate embeddings: ${error.message}`,
                });
            }
        }

        return results;
    }

    countTokens(text: string): number {
        try {
            return this.encoder.encode(text).length;
        } catch {
            // Fallback estimation: ~4 characters per token
            return Math.ceil(text.length / 4);
        }
    }

    private truncateToTokenLimit(text: string): string {
        const tokens = this.encoder.encode(text);

        if (tokens.length <= this.maxInputTokens) {
            return text;
        }

        // Truncate and decode
        const truncatedTokens = tokens.slice(0, this.maxInputTokens);
        return this.encoder.decode(truncatedTokens);
    }

    cleanup(): void {
        // Free encoder resources
        if (this.encoder && typeof this.encoder.free === 'function') {
            this.encoder.free();
        }
    }
}