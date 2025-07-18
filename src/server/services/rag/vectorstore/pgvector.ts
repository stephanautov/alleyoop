// File: src/server/services/rag/vectorstore/pgvector.ts
// ============================================

import { PrismaClient } from "@prisma/client";
import { BaseVectorStore } from "./base";
import type { SearchResult, RetrievalOptions, VectorStoreConfig } from "../types";
import { TRPCError } from "@trpc/server";

export class PgVectorStore extends BaseVectorStore {
    constructor(
        private prisma: PrismaClient,
        config: VectorStoreConfig = {}
    ) {
        super(config);
    }

    async initialize(): Promise<void> {
        // Ensure pgvector extension is installed
        try {
            await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;

            // Create index on embedding column if it doesn't exist
            await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS embedding_vector_idx 
        ON "Embedding" 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;

            console.log("✅ PgVector initialized successfully");
        } catch (error) {
            console.error("Failed to initialize pgvector:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to initialize vector store",
            });
        }
    }

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
        try {
            // Delete existing embeddings for this source
            await this.deleteSource(sourceId);

            // Batch insert new embeddings
            const data = embeddings.map(item => ({
                sourceId,
                chunkIndex: item.chunkIndex,
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata || {},
                tokenCount: item.tokenCount,
            }));

            await this.prisma.embedding.createMany({ data });

            console.log(`✅ Stored ${embeddings.length} embeddings for source ${sourceId}`);
        } catch (error) {
            console.error("Failed to store embeddings:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to store embeddings",
            });
        }
    }

    async search(
        queryEmbedding: number[],
        options: RetrievalOptions
    ): Promise<SearchResult[]> {
        const {
            limit = 5,
            threshold = 0.7,
            sourceIds,
            userId,
            includeMetadata = true,
            rerank = false
        } = options;

        try {
            // Build WHERE clause
            const conditions: string[] = [];

            if (userId) {
                conditions.push(`ks."userId" = '${userId}'`);
            }

            if (sourceIds && sourceIds.length > 0) {
                const sourceIdList = sourceIds.map(id => `'${id}'`).join(",");
                conditions.push(`e."sourceId" IN (${sourceIdList})`);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

            // Perform vector similarity search
            const results = await this.prisma.$queryRaw<Array<{
                id: string;
                content: string;
                similarity: number;
                metadata: any;
                sourceId: string;
                sourceName: string;
                sourceType: string;
            }>>`
        SELECT 
          e.id,
          e.content,
          ${includeMetadata ? 'e.metadata,' : ''}
          e."sourceId",
          ks.name as "sourceName",
          ks.type as "sourceType",
          1 - (e.embedding <=> ${queryEmbedding}::vector) as similarity
        FROM "Embedding" e
        JOIN "KnowledgeSource" ks ON e."sourceId" = ks.id
        ${whereClause}
        HAVING 1 - (e.embedding <=> ${queryEmbedding}::vector) > ${threshold}
        ORDER BY e.embedding <=> ${queryEmbedding}::vector
        LIMIT ${limit * (rerank ? 2 : 1)}
      `;

            // Apply reranking if requested
            let finalResults = results;
            if (rerank && results.length > 0) {
                // Simple reranking based on metadata relevance
                finalResults = this.rerankResults(results, limit);
            }

            return finalResults.slice(0, limit).map(result => ({
                id: result.id,
                content: result.content,
                similarity: result.similarity,
                metadata: result.metadata || {},
                sourceId: result.sourceId,
                sourceName: result.sourceName,
            }));
        } catch (error) {
            console.error("Vector search failed:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to perform vector search",
            });
        }
    }

    async deleteSource(sourceId: string): Promise<void> {
        await this.prisma.embedding.deleteMany({
            where: { sourceId },
        });
    }

    async getStats(): Promise<{
        totalVectors: number;
        totalSources: number;
        indexSize?: number;
    }> {
        const [totalVectors, totalSources] = await Promise.all([
            this.prisma.embedding.count(),
            this.prisma.knowledgeSource.count(),
        ]);

        // Get approximate index size
        const indexSize = await this.prisma.$queryRaw<Array<{ size: bigint }>>`
      SELECT pg_size_pretty(pg_relation_size('embedding_vector_idx')) as size
    `.then(result => result[0]?.size || 0);

        return {
            totalVectors,
            totalSources,
            indexSize: Number(indexSize),
        };
    }

    private rerankResults(
        results: Array<any>,
        limit: number
    ): Array<any> {
        // Simple reranking based on source type and metadata
        return results
            .map(result => {
                let score = result.similarity;

                // Boost documents from certain source types
                if (result.sourceType === 'DOCUMENT') {
                    score *= 1.1;
                }

                // Boost if metadata contains certain signals
                if (result.metadata?.isRecent) {
                    score *= 1.05;
                }

                return { ...result, finalScore: score };
            })
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, limit);
    }
}