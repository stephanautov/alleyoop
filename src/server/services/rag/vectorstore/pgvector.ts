// File: src/server/services/rag/vectorstore/pgvector.ts
// ============================================

import { PrismaClient } from "@prisma/client";
import { EmbeddingService } from "../embeddings";

export interface SearchResult {
    id: string;
    content: string;
    similarity: number;
    metadata?: Record<string, any>;
    sourceId: string;
    sourceName: string;
}

export class PgVectorStore {
    constructor(
        private prisma: PrismaClient,
        private embeddingService: EmbeddingService
    ) { }

    /**
     * Store embeddings in the database
     */
    async storeEmbeddings(
        sourceId: string,
        embeddings: Array<{
            content: string;
            embedding: number[];
            metadata?: Record<string, any>;
            chunkIndex: number;
            tokenCount?: number;
        }>
    ): Promise<void> {
        // Store embeddings in batches
        const batchSize = 100;
        for (let i = 0; i < embeddings.length; i += batchSize) {
            const batch = embeddings.slice(i, i + batchSize);

            await this.prisma.embedding.createMany({
                data: batch.map(item => ({
                    sourceId,
                    chunkIndex: item.chunkIndex,
                    content: item.content,
                    embedding: item.embedding,
                    metadata: item.metadata || {},
                    tokenCount: item.tokenCount,
                })),
            });
        }
    }

    /**
     * Search for similar content using vector similarity
     */
    async search(
        query: string,
        options: {
            userId: string;
            limit?: number;
            threshold?: number;
            sourceIds?: string[];
        }
    ): Promise<SearchResult[]> {
        const { userId, limit = 5, threshold = 0.7, sourceIds } = options;

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.embedQuery(query);

        // Build the query
        let whereClause = `ks."userId" = '${userId}'`;
        if (sourceIds && sourceIds.length > 0) {
            whereClause += ` AND e."sourceId" IN (${sourceIds.map(id => `'${id}'`).join(",")})`;
        }

        // Perform vector similarity search using pgvector
        // Note: This assumes pgvector extension is installed and the embedding column has a vector index
        const results = await this.prisma.$queryRaw<Array<{
            id: string;
            content: string;
            similarity: number;
            metadata: any;
            sourceId: string;
            sourceName: string;
        }>>`
      SELECT 
        e.id,
        e.content,
        e.metadata,
        e."sourceId",
        ks.name as "sourceName",
        1 - (e.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM "Embedding" e
      JOIN "KnowledgeSource" ks ON e."sourceId" = ks.id
      WHERE ${whereClause}
        AND 1 - (e.embedding <=> ${queryEmbedding}::vector) > ${threshold}
      ORDER BY e.embedding <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    `;

        return results.map(result => ({
            id: result.id,
            content: result.content,
            similarity: result.similarity,
            metadata: result.metadata,
            sourceId: result.sourceId,
            sourceName: result.sourceName,
        }));
    }

    /**
     * Delete all embeddings for a source
     */
    async deleteSourceEmbeddings(sourceId: string): Promise<void> {
        await this.prisma.embedding.deleteMany({
            where: { sourceId },
        });
    }
}