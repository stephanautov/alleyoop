// File: src/server/services/rag/index.ts
// ============================================

import { PrismaClient } from "@prisma/client";
import { DocumentProcessor } from "./processing/document-processor";
import { EmbeddingService } from "./embeddings";
import { PgVectorStore } from "./vectorstore/pgvector";

export interface RAGContext {
    sources: Array<{
        id: string;
        name: string;
        content: string;
        similarity: number;
    }>;
    query: string;
    totalTokens: number;
}

export class RAGService {
    private processor: DocumentProcessor;
    private embeddingService: EmbeddingService;
    private vectorStore: PgVectorStore;

    constructor(private prisma: PrismaClient) {
        this.processor = new DocumentProcessor();
        this.embeddingService = new EmbeddingService();
        this.vectorStore = new PgVectorStore(prisma, this.embeddingService);
    }

    /**
     * Process and store a knowledge source
     */
    async ingestDocument(
        sourceId: string,
        buffer: Buffer,
        mimeType: string
    ): Promise<void> {
        try {
            // Update status to processing
            await this.prisma.knowledgeSource.update({
                where: { id: sourceId },
                data: { status: "PROCESSING" },
            });

            // Process document into chunks
            const processed = await this.processor.processDocument(buffer, mimeType);

            // Generate embeddings for chunks
            const embeddings = await this.embeddingService.embedChunks(processed.chunks);

            // Store embeddings
            await this.vectorStore.storeEmbeddings(
                sourceId,
                embeddings.map((item, index) => ({
                    content: item.chunk.content,
                    embedding: item.embedding,
                    metadata: {
                        ...item.chunk.metadata,
                        ...processed.metadata,
                    },
                    chunkIndex: index,
                    tokenCount: item.tokenCount,
                }))
            );

            // Update source with processed content
            await this.prisma.knowledgeSource.update({
                where: { id: sourceId },
                data: {
                    content: processed.content,
                    status: "COMPLETED",
                    processedAt: new Date(),
                    metadata: processed.metadata,
                },
            });
        } catch (error) {
            // Update status to failed
            await this.prisma.knowledgeSource.update({
                where: { id: sourceId },
                data: {
                    status: "FAILED",
                    error: error.message,
                },
            });
            throw error;
        }
    }

    /**
     * Retrieve relevant context for a query
     */
    async retrieveContext(
        query: string,
        userId: string,
        options: {
            limit?: number;
            sourceIds?: string[];
            threshold?: number;
        } = {}
    ): Promise<RAGContext> {
        const results = await this.vectorStore.search(query, {
            userId,
            ...options,
        });

        // Calculate total tokens (approximate)
        const totalTokens = results.reduce((sum, result) => {
            return sum + (result.content.length / 4); // Rough token estimate
        }, 0);

        return {
            query,
            sources: results.map(result => ({
                id: result.sourceId,
                name: result.sourceName,
                content: result.content,
                similarity: result.similarity,
            })),
            totalTokens: Math.ceil(totalTokens),
        };
    }

    /**
     * Build a context-enhanced prompt
     */
    buildRAGPrompt(
        basePrompt: string,
        context: RAGContext,
        options: {
            maxContextTokens?: number;
            includeSourceNames?: boolean;
        } = {}
    ): string {
        const { maxContextTokens = 2000, includeSourceNames = true } = options;

        let contextSection = "Relevant context from knowledge base:\n\n";
        let currentTokens = 0;

        for (const source of context.sources) {
            const sourceTokens = Math.ceil(source.content.length / 4);
            if (currentTokens + sourceTokens > maxContextTokens) {
                break;
            }

            if (includeSourceNames) {
                contextSection += `[From: ${source.name}]\n`;
            }
            contextSection += `${source.content}\n\n`;
            currentTokens += sourceTokens;
        }

        return `${contextSection}---\n\nBased on the above context, ${basePrompt}`;
    }
}