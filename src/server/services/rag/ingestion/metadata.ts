// File: src/server/services/rag/ingestion/metadata.ts
// ============================================

import type { DocumentMetadata } from "../types";
import pdfParse from "pdf-parse";

export class MetadataExtractor {
    /**
     * Extract metadata from document based on content and type
     */
    async extractMetadata(
        buffer: Buffer,
        mimeType: string,
        content: string
    ): Promise<DocumentMetadata> {
        const baseMetadata: DocumentMetadata = {
            mimeType,
            wordCount: content.split(/\s+/).length,
            language: this.detectLanguage(content),
            createdAt: new Date(),
        };

        // Extract type-specific metadata
        switch (mimeType) {
            case 'application/pdf':
                return { ...baseMetadata, ...(await this.extractPdfMetadata(buffer)) };

            case 'text/markdown':
                return { ...baseMetadata, ...this.extractMarkdownMetadata(content) };

            default:
                return { ...baseMetadata, ...this.extractGeneralMetadata(content) };
        }
    }

    /**
     * Extract metadata from PDF
     */
    private async extractPdfMetadata(buffer: Buffer): Promise<Partial<DocumentMetadata>> {
        try {
            const data = await pdfParse(buffer);
            return {
                title: data.info?.Title,
                author: data.info?.Author,
                pageCount: data.numpages,
                createdAt: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
            };
        } catch (error) {
            console.error('PDF metadata extraction error:', error);
            return {};
        }
    }

    /**
     * Extract metadata from Markdown
     */
    private extractMarkdownMetadata(content: string): Partial<DocumentMetadata> {
        const metadata: Partial<DocumentMetadata> = {};

        // Extract front matter if present
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontMatterMatch) {
            const frontMatter = frontMatterMatch[1];
            const lines = frontMatter.split('\n');

            for (const line of lines) {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key && value) {
                    metadata[key.toLowerCase()] = value;
                }
            }
        }

        // Extract title from first heading
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch && !metadata.title) {
            metadata.title = titleMatch[1];
        }

        return metadata;
    }

    /**
     * Extract general metadata from any text
     */
    private extractGeneralMetadata(content: string): Partial<DocumentMetadata> {
        const metadata: Partial<DocumentMetadata> = {};

        // Try to extract title from first line or heading
        const lines = content.split('\n');
        const firstNonEmptyLine = lines.find(line => line.trim());
        if (firstNonEmptyLine && firstNonEmptyLine.length < 100) {
            metadata.title = firstNonEmptyLine.trim();
        }

        // Extract key phrases (simple implementation)
        const keyPhrases = this.extractKeyPhrases(content);
        if (keyPhrases.length > 0) {
            metadata.keywords = keyPhrases;
        }

        return metadata;
    }

    /**
     * Simple language detection based on common words
     */
    private detectLanguage(content: string): string {
        const languages = {
            en: ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that'],
            es: ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'una'],
            fr: ['le', 'de', 'et', 'la', 'les', 'des', 'un', 'une'],
            de: ['der', 'die', 'und', 'das', 'ist', 'ein', 'eine', 'den'],
        };

        const words = content.toLowerCase().split(/\s+/);
        const scores: Record<string, number> = {};

        for (const [lang, commonWords] of Object.entries(languages)) {
            scores[lang] = words.filter(word => commonWords.includes(word)).length;
        }

        const detectedLang = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])[0][0];

        return detectedLang || 'en';
    }

    /**
     * Extract key phrases from content
     */
    private extractKeyPhrases(content: string, maxPhrases: number = 10): string[] {
        // Simple frequency-based extraction
        const words = content
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 4); // Skip short words

        const frequency: Record<string, number> = {};
        for (const word of words) {
            frequency[word] = (frequency[word] || 0) + 1;
        }

        // Filter out common stop words
        const stopWords = new Set([
            'about', 'above', 'after', 'again', 'against', 'because',
            'before', 'being', 'below', 'between', 'through', 'during',
            'where', 'which', 'while', 'would', 'there', 'these', 'those',
        ]);

        return Object.entries(frequency)
            .filter(([word]) => !stopWords.has(word))
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxPhrases)
            .map(([word]) => word);
    }
}