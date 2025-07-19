// File: src/server/services/rag/vectorstore/base.ts
// ============================================

export abstract class BaseVectorStore {
    protected config: VectorStoreConfig;

    constructor(config: VectorStoreConfig = {}) {
        this.config = {
            dimension: 1536, // OpenAI default
            metric: 'cosine',
            ...config,
        };
    }

    /**
     * Initialize the vector store (create indexes, etc.)
     */
    abstract initialize(): Promise<void>;

    /**
     * Store embeddings in the vector store
     */
    abstract storeEmbeddings(
        sourceId: string,
        embeddings: Array<{
            content: string;
            embedding: number[];
            metadata?: Record<string, any>;
            chunkIndex: number;
            tokenCount?: number;
        }>
    ): Promise<void>;

    /**
     * Search for similar vectors
     */
    abstract search(
        queryEmbedding: number[],
        options: RetrievalOptions
    ): Promise<SearchResult[]>;

    /**
     * Delete all embeddings for a source
     */
    abstract deleteSource(sourceId: string): Promise<void>;

    /**
     * Get statistics about the vector store
     */
    abstract getStats(): Promise<{
        totalVectors: number;
        totalSources: number;
        indexSize?: number;
    }>;

    /**
     * Perform batch searches
     */
    async batchSearch(
        queries: Array<{ id: string; embedding: number[] }>,
        options: RetrievalOptions
    ): Promise<Map<string, SearchResult[]>> {
        const results = new Map<string, SearchResult[]>();

        // Default implementation - can be overridden for better performance
        for (const query of queries) {
            const searchResults = await this.search(query.embedding, options);
            results.set(query.id, searchResults);
        }

        return results;
    }
}