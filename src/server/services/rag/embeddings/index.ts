// File: src/server/services/rag/embeddings/index.ts
// ============================================

import { OpenAIEmbeddingService } from "./openai";
import { BaseEmbeddingService } from "./base";
import { env } from "~/env";

export type EmbeddingProvider = 'openai' | 'cohere' | 'huggingface';

export class EmbeddingService {
    private service: BaseEmbeddingService;

    constructor(
        provider: EmbeddingProvider = 'openai',
        options: {
            apiKey?: string;
            model?: string;
            dimension?: number;
        } = {}
    ) {
        switch (provider) {
            case 'openai':
                this.service = new OpenAIEmbeddingService(
                    options.apiKey,
                    options.model || env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small',
                    options.dimension || 1536
                );
                break;

            // Future providers
            case 'cohere':
            case 'huggingface':
                throw new Error(`Provider ${provider} not yet implemented`);

            default:
                throw new Error(`Unknown embedding provider: ${provider}`);
        }
    }

    // Delegate all methods to the underlying service
    async embedText(text: string) {
        return this.service.embedText(text);
    }

    async embedBatch(texts: string[]) {
        return this.service.embedBatch(texts);
    }

    async embedQuery(query: string) {
        return this.service.embedQuery(query);
    }

    async embedChunks(chunks: any[]) {
        return this.service.embedChunks(chunks);
    }

    countTokens(text: string) {
        return this.service.countTokens(text);
    }

    getModel() {
        return this.service.getModel();
    }

    getDimension() {
        return this.service.getDimension();
    }
}

// Export types and classes
export { OpenAIEmbeddingService };
export type { EmbeddingResult, TextChunk, ChunkWithEmbedding } from '../types';