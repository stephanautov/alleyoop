// File: src/server/services/rag/ingestion/pipeline.ts
// ============================================

import { DocumentChunker } from "./document";
import { MetadataExtractor } from "./metadata";
import type { ProcessedDocument, IngestionOptions } from "../types";
import { Queue } from "bullmq";
import { env } from "~/env";

export class IngestionPipeline {
    private chunker: DocumentChunker;
    private metadataExtractor: MetadataExtractor;
    private queue?: Queue;

    constructor(options: IngestionOptions = {}) {
        this.chunker = new DocumentChunker(options);
        this.metadataExtractor = new MetadataExtractor();

        // Initialize queue if Redis is available
        if (env.REDIS_URL) {
            this.queue = new Queue('document-ingestion', {
                connection: {
                    url: env.REDIS_URL,
                },
            });
        }
    }

    /**
     * Process a document through the full ingestion pipeline
     */
    async processDocument(
        buffer: Buffer,
        mimeType: string,
        options: IngestionOptions = {}
    ): Promise<ProcessedDocument> {
        try {
            // Step 1: Extract text
            const content = await this.chunker.extractText(buffer, mimeType);

            // Step 2: Extract metadata
            const metadata = await this.metadataExtractor.extractMetadata(
                buffer,
                mimeType,
                content
            );

            // Step 3: Chunk the text
            const chunks = options.generateSummaries
                ? await this.chunker.smartChunk(content, options)
                : await this.chunker.chunkText(content, options);

            // Step 4: Enhance chunk metadata
            const enhancedChunks = chunks.map(chunk => ({
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    documentTitle: metadata.title,
                    documentType: mimeType,
                },
            }));

            return {
                content,
                chunks: enhancedChunks,
                metadata,
            };
        } catch (error) {
            console.error('Document processing error:', error);
            throw new Error(`Failed to process document: ${error.message}`);
        }
    }

    /**
     * Queue document for async processing
     */
    async queueDocument(
        documentId: string,
        buffer: Buffer,
        mimeType: string,
        options: IngestionOptions = {}
    ): Promise<string> {
        if (!this.queue) {
            throw new Error('Queue not initialized');
        }

        const job = await this.queue.add('process-document', {
            documentId,
            buffer: buffer.toString('base64'),
            mimeType,
            options,
        });

        return job.id!;
    }

    /**
     * Batch process multiple documents
     */
    async batchProcess(
        documents: Array<{
            id: string;
            buffer: Buffer;
            mimeType: string;
        }>,
        options: IngestionOptions = {}
    ): Promise<Map<string, ProcessedDocument>> {
        const results = new Map<string, ProcessedDocument>();

        // Process in parallel with concurrency limit
        const concurrency = 3;
        for (let i = 0; i < documents.length; i += concurrency) {
            const batch = documents.slice(i, i + concurrency);
            const processed = await Promise.all(
                batch.map(async doc => {
                    try {
                        const result = await this.processDocument(
                            doc.buffer,
                            doc.mimeType,
                            options
                        );
                        return { id: doc.id, result };
                    } catch (error) {
                        console.error(`Failed to process document ${doc.id}:`, error);
                        return null;
                    }
                })
            );

            for (const item of processed) {
                if (item) {
                    results.set(item.id, item.result);
                }
            }
        }

        return results;
    }
}