// File: src/server/services/rag/processing/document-processor.ts
// ============================================

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// Dynamic imports will be used for heavy parsers to avoid issues during bundling.
type PdfParseFn = (buffer: Buffer) => Promise<{ text: string; numpages?: number }>;
type MammothModule = typeof import("mammoth");
import { decode } from "html-entities";

export interface TextChunk {
    content: string;
    index: number;
    metadata: Record<string, any>;
}

export interface ProcessedDocument {
    content: string;
    chunks: TextChunk[];
    metadata: {
        pageCount?: number;
        wordCount: number;
        mimeType: string;
        [key: string]: any;
    };
}

export class DocumentProcessor {
    private splitter: RecursiveCharacterTextSplitter;

    constructor() {
        this.splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: ["\n\n", "\n", ". ", " ", ""],
        });
    }

    /**
     * Process a document file into chunks
     */
    async processDocument(
        buffer: Buffer,
        mimeType: string,
        options: {
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ): Promise<ProcessedDocument> {
        // Update splitter if custom options provided
        if (options.chunkSize || options.chunkOverlap) {
            this.splitter = new RecursiveCharacterTextSplitter({
                chunkSize: options.chunkSize || 1000,
                chunkOverlap: options.chunkOverlap || 200,
            });
        }

        let content: string;
        let metadata: ProcessedDocument["metadata"] = {
            mimeType,
            wordCount: 0,
        };

        // Extract text based on file type
        switch (mimeType) {
            case "application/pdf":
                const { default: parsePdf } = await import("pdf-parse") as { default: PdfParseFn };
                const pdfData = await parsePdf(buffer);
                content = pdfData.text;
                metadata.pageCount = pdfData.numpages;
                break;

            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            case "application/msword":
                const mammothModule = await import("mammoth") as unknown as MammothModule;
                const docResult = await mammothModule.extractRawText({ buffer });
                content = docResult.value;
                break;

            case "text/plain":
            case "text/markdown":
                content = buffer.toString("utf-8");
                break;

            case "text/html":
                content = this.extractTextFromHtml(buffer.toString("utf-8"));
                break;

            default:
                throw new Error(`Unsupported file type: ${mimeType}`);
        }

        // Clean and normalize content
        content = this.normalizeText(content);
        metadata.wordCount = content.split(/\s+/).length;

        // Split into chunks
        const textChunks = await this.splitter.splitText(content);
        const chunks: TextChunk[] = textChunks.map((chunk, index) => ({
            content: chunk,
            index,
            metadata: {
                chunkIndex: index,
                totalChunks: textChunks.length,
            },
        }));

        return {
            content,
            chunks,
            metadata,
        };
    }

    /**
     * Extract text from HTML
     */
    private extractTextFromHtml(html: string): string {
        // Remove scripts and styles
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

        // Replace common tags with spaces
        html = html.replace(/<br\s*\/?>/gi, "\n");
        html = html.replace(/<\/p>/gi, "\n\n");
        html = html.replace(/<\/div>/gi, "\n");
        html = html.replace(/<\/h[1-6]>/gi, "\n\n");

        // Remove all other tags
        html = html.replace(/<[^>]+>/g, " ");

        // Decode HTML entities
        html = decode(html);

        // Clean up whitespace
        return this.normalizeText(html);
    }

    /**
     * Normalize text content
     */
    private normalizeText(text: string): string {
        return text
            .replace(/\r\n/g, "\n") // Normalize line endings
            .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
            .replace(/\s+/g, " ") // Normalize spaces
            .replace(/^\s+|\s+$/g, "") // Trim
            .trim();
    }
}