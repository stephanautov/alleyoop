// File: src/server/services/rag/ingestion/document.ts
// ============================================

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { decode } from "html-entities";
import { TextChunk, IngestionOptions } from "../types";

export class DocumentChunker {
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor(options: IngestionOptions = {}) {
        const {
            chunkSize = 1000,
            chunkOverlap = 200,
        } = options;

        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
            separators: ["\n\n", "\n", ". ", " ", ""],
        });
    }

    /**
     * Process document buffer and extract text based on MIME type
     */
    async extractText(buffer: Buffer, mimeType: string): Promise<string> {
        switch (mimeType) {
            case 'application/pdf':
                return this.extractPdfText(buffer);

            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            case 'application/msword':
                return this.extractDocxText(buffer);

            case 'text/plain':
            case 'text/markdown':
                return buffer.toString('utf-8');

            case 'text/html':
                return this.extractHtmlText(buffer.toString('utf-8'));

            default:
                throw new Error(`Unsupported file type: ${mimeType}`);
        }
    }

    /**
     * Extract text from PDF
     */
    private async extractPdfText(buffer: Buffer): Promise<string> {
        try {
            const data = await pdfParse(buffer);
            return data.text;
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    /**
     * Extract text from DOCX
     */
    private async extractDocxText(buffer: Buffer): Promise<string> {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } catch (error) {
            console.error('DOCX extraction error:', error);
            throw new Error('Failed to extract text from DOCX');
        }
    }

    /**
     * Extract text from HTML
     */
    private extractHtmlText(html: string): string {
        // Remove script and style tags
        const cleanHtml = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // Extract text and decode HTML entities
        const text = cleanHtml.replace(/<[^>]+>/g, ' ');
        return decode(text).replace(/\s+/g, ' ').trim();
    }

    /**
     * Split text into chunks with metadata
     */
    async chunkText(
        text: string,
        options: {
            preserveFormatting?: boolean;
            generateSummaries?: boolean;
        } = {}
    ): Promise<TextChunk[]> {
        const { preserveFormatting = true } = options;

        // Pre-process text if needed
        let processedText = text;
        if (preserveFormatting) {
            // Preserve paragraph structure
            processedText = text.replace(/\n{3,}/g, '\n\n');
        }

        // Split text into chunks
        const chunks = await this.textSplitter.splitText(processedText);

        // Create TextChunk objects with metadata
        return chunks.map((content, index) => ({
            content: content.trim(),
            index,
            metadata: {
                chunkIndex: index,
                startChar: this.getStartPosition(text, content),
                endChar: this.getEndPosition(text, content),
                wordCount: content.split(/\s+/).length,
            },
        }));
    }

    /**
     * Smart chunking that respects document structure
     */
    async smartChunk(
        text: string,
        options: IngestionOptions = {}
    ): Promise<TextChunk[]> {
        // Detect document sections
        const sections = this.detectSections(text);
        const chunks: TextChunk[] = [];
        let chunkIndex = 0;

        for (const section of sections) {
            // Check if section fits in one chunk
            if (section.content.length <= (options.chunkSize || 1000)) {
                chunks.push({
                    content: section.content,
                    index: chunkIndex++,
                    metadata: {
                        ...section.metadata,
                        chunkIndex: chunkIndex - 1,
                    },
                });
            } else {
                // Split large sections
                const sectionChunks = await this.chunkText(section.content, options);
                for (const chunk of sectionChunks) {
                    chunks.push({
                        ...chunk,
                        index: chunkIndex++,
                        metadata: {
                            ...chunk.metadata,
                            ...section.metadata,
                            chunkIndex: chunkIndex - 1,
                        },
                    });
                }
            }
        }

        return chunks;
    }

    /**
     * Detect sections in document based on headings and structure
     */
    private detectSections(text: string): Array<{
        content: string;
        metadata: Record<string, any>;
    }> {
        const sections: Array<{ content: string; metadata: Record<string, any> }> = [];

        // Simple section detection based on double newlines and heading patterns
        const potentialSections = text.split(/\n\n+/);

        for (let i = 0; i < potentialSections.length; i++) {
            const content = potentialSections[i].trim();
            if (!content) continue;

            const metadata: Record<string, any> = {};

            // Check if it starts with a heading pattern
            const headingMatch = content.match(/^(#{1,6}|[A-Z][A-Z\s]+:|^\d+\.|^[IVX]+\.)(.+)/);
            if (headingMatch) {
                metadata.heading = headingMatch[2].trim();
                metadata.level = this.getHeadingLevel(headingMatch[1]);
            }

            // Check for bullet points or lists
            if (content.match(/^[\*\-\d]+\./m)) {
                metadata.isList = true;
            }

            sections.push({ content, metadata });
        }

        return sections;
    }

    private getHeadingLevel(marker: string): number {
        if (marker.startsWith('#')) return marker.length;
        if (marker.match(/^\d+\./)) return 2;
        if (marker.match(/^[IVX]+\./)) return 1;
        return 3;
    }

    private getStartPosition(fullText: string, chunk: string): number {
        const index = fullText.indexOf(chunk);
        return index >= 0 ? index : 0;
    }

    private getEndPosition(fullText: string, chunk: string): number {
        const start = this.getStartPosition(fullText, chunk);
        return start + chunk.length;
    }
}