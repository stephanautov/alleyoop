// File: src/server/services/rag/types.ts
// ============================================

export interface EmbeddingResult {
    embedding: number[];
    tokenCount: number;
}

export interface TextChunk {
    content: string;
    metadata?: Record<string, any>;
    index: number;
}

export interface ChunkWithEmbedding extends TextChunk {
    embedding: number[];
    tokenCount: number;
}

export interface SearchResult {
    id: string;
    content: string;
    similarity: number;
    metadata: Record<string, any>;
    sourceId: string;
    sourceName: string;
}

export interface DocumentMetadata {
    title?: string;
    author?: string;
    pageCount?: number;
    wordCount?: number;
    language?: string;
    createdAt?: Date;
    mimeType?: string;
    [key: string]: any;
}

export interface ProcessedDocument {
    content: string;
    chunks: TextChunk[];
    metadata: DocumentMetadata;
}

export interface VectorStoreConfig {
    dimension?: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
    indexName?: string;
}

export interface RetrievalOptions {
    limit?: number;
    threshold?: number;
    sourceIds?: string[];
    userId?: string;
    includeMetadata?: boolean;
    rerank?: boolean;
}

export interface IngestionOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    preserveFormatting?: boolean;
    extractMetadata?: boolean;
    generateSummaries?: boolean;
}