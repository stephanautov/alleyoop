// src/server/services/document/rag-enhanced-generation.ts
import { RAGService } from "~/server/services/rag";
import { db } from "~/server/db";
import type { DocumentType } from "@prisma/client";

export interface RAGEnhancedInput {
    documentType: DocumentType;
    baseInput: any;
    userId: string;
    knowledgeSourceIds?: string[];
    autoSelectSources?: boolean;
    ragConfig?: {
        maxResults?: number;
        minSimilarity?: number;
        includeMetadata?: boolean;
    };
}

export interface RAGContext {
    sources: Array<{
        id: string;
        name: string;
        content: string;
        similarity: number;
        metadata?: any;
    }>;
    summary?: string;
    relevantSections: Record<string, string[]>;
}

export class RAGEnhancedGenerator {
    private ragService: RAGService;

    constructor() {
        this.ragService = new RAGService(db);
    }

    /**
     * Generate RAG-enhanced context for document generation
     */
    async generateRAGContext(params: RAGEnhancedInput): Promise<RAGContext | null> {
        const {
            documentType,
            baseInput,
            userId,
            knowledgeSourceIds,
            autoSelectSources = true,
            ragConfig = {},
        } = params;

        try {
            // Build search queries based on document type
            const queries = this.buildSearchQueries(documentType, baseInput);

            if (queries.length === 0) {
                return null;
            }

            // Search across knowledge sources
            const allResults = [];

            for (const query of queries) {
                const results = await this.ragService.search(query, {
                    userId,
                    limit: ragConfig.maxResults || 5,
                    threshold: ragConfig.minSimilarity || 0.7,
                    sourceIds: knowledgeSourceIds,
                });

                allResults.push(...results);
            }

            // Deduplicate and sort by relevance
            const uniqueResults = this.deduplicateResults(allResults);

            if (uniqueResults.length === 0) {
                return null;
            }

            // Organize results by relevance to sections
            const context = await this.buildContext(
                uniqueResults,
                documentType,
                baseInput,
                ragConfig.includeMetadata
            );

            return context;
        } catch (error) {
            console.error('RAG context generation error:', error);
            return null;
        }
    }

    /**
     * Build search queries based on document type and input
     */
    private buildSearchQueries(documentType: DocumentType, input: any): string[] {
        const queries: string[] = [];

        switch (documentType) {
            case 'BIOGRAPHY':
                if (input.subjectName) {
                    queries.push(input.subjectName);
                    if (input.focusAreas?.length) {
                        queries.push(...input.focusAreas.map(area =>
                            `${input.subjectName} ${area}`
                        ));
                    }
                }
                break;

            case 'BUSINESS_PLAN':
                if (input.businessName) {
                    queries.push(input.businessName);
                }
                if (input.industry) {
                    queries.push(`${input.industry} industry analysis`);
                    queries.push(`${input.industry} market trends`);
                }
                if (input.targetMarket) {
                    queries.push(`${input.targetMarket} customer demographics`);
                }
                break;

            case 'CASE_SUMMARY':
                if (input.caseName) {
                    queries.push(input.caseName);
                }
                if (input.legalArea) {
                    queries.push(`${input.legalArea} law precedents`);
                }
                if (input.keyIssues?.length) {
                    queries.push(...input.keyIssues);
                }
                break;

            case 'GRANT_PROPOSAL':
                if (input.projectTitle) {
                    queries.push(input.projectTitle);
                }
                if (input.focusArea) {
                    queries.push(`${input.focusArea} grant funding`);
                    queries.push(`${input.focusArea} research`);
                }
                if (input.organization?.name) {
                    queries.push(input.organization.name);
                }
                break;

            case 'MEDICAL_REPORT':
                if (input.condition) {
                    queries.push(`${input.condition} diagnosis`);
                    queries.push(`${input.condition} treatment`);
                }
                if (input.specialty) {
                    queries.push(`${input.specialty} guidelines`);
                }
                break;
        }

        // Add any custom search terms
        if (input.ragSearchTerms?.length) {
            queries.push(...input.ragSearchTerms);
        }

        return [...new Set(queries)]; // Remove duplicates
    }

    /**
     * Deduplicate search results
     */
    private deduplicateResults(results: any[]): any[] {
        const seen = new Map<string, any>();

        for (const result of results) {
            const key = `${result.sourceId}:${result.id}`;
            const existing = seen.get(key);

            if (!existing || result.similarity > existing.similarity) {
                seen.set(key, result);
            }
        }

        return Array.from(seen.values())
            .sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Build structured context from search results
     */
    private async buildContext(
        results: any[],
        documentType: DocumentType,
        input: any,
        includeMetadata: boolean
    ): Promise<RAGContext> {
        // Get source details
        const sourceIds = [...new Set(results.map(r => r.sourceId))];
        const sources = await db.knowledgeSource.findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, name: true, type: true },
        });

        const sourceMap = new Map(sources.map(s => [s.id, s]));

        // Build context structure
        const context: RAGContext = {
            sources: results.slice(0, 10).map(result => ({
                id: result.id,
                name: sourceMap.get(result.sourceId)?.name || 'Unknown Source',
                content: result.content,
                similarity: result.similarity,
                metadata: includeMetadata ? result.metadata : undefined,
            })),
            relevantSections: {},
        };

        // Map content to document sections based on type
        context.relevantSections = this.mapContentToSections(
            documentType,
            input,
            context.sources
        );

        // Generate summary if multiple sources
        if (context.sources.length > 1) {
            context.summary = this.generateContextSummary(context.sources);
        }

        return context;
    }

    /**
     * Map RAG content to document sections
     */
    private mapContentToSections(
        documentType: DocumentType,
        input: any,
        sources: RAGContext['sources']
    ): Record<string, string[]> {
        const sectionMap: Record<string, string[]> = {};

        // Default sections for all document types
        sectionMap.introduction = sources
            .filter(s => s.similarity > 0.8)
            .map(s => s.content);

        // Document-specific section mapping
        switch (documentType) {
            case 'BIOGRAPHY':
                sectionMap.background = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('background') ||
                        s.content.toLowerCase().includes('early life')
                    )
                    .map(s => s.content);

                sectionMap.achievements = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('achievement') ||
                        s.content.toLowerCase().includes('award')
                    )
                    .map(s => s.content);
                break;

            case 'BUSINESS_PLAN':
                sectionMap.market_analysis = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('market') ||
                        s.content.toLowerCase().includes('industry')
                    )
                    .map(s => s.content);

                sectionMap.competitive_analysis = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('competitor') ||
                        s.content.toLowerCase().includes('competition')
                    )
                    .map(s => s.content);
                break;

            case 'GRANT_PROPOSAL':
                sectionMap.statement_of_need = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('need') ||
                        s.content.toLowerCase().includes('problem')
                    )
                    .map(s => s.content);

                sectionMap.methodology = sources
                    .filter(s =>
                        s.content.toLowerCase().includes('method') ||
                        s.content.toLowerCase().includes('approach')
                    )
                    .map(s => s.content);
                break;
        }

        return sectionMap;
    }

    /**
     * Generate a summary of the context
     */
    private generateContextSummary(sources: RAGContext['sources']): string {
        const topSources = sources.slice(0, 3);
        return `Found ${sources.length} relevant sources. Top matches include content about: ${topSources.map(s => {
            const preview = s.content.substring(0, 100).trim();
            return `"${preview}..."`;
        }).join(', ')
            }`;
    }
}

/**
 * Integration helper for unified document service
 */
export async function enhanceWithRAG(
    documentType: DocumentType,
    input: any,
    userId: string,
    config: {
        knowledgeSourceIds?: string[];
        ragEnabled?: boolean;
        autoRAG?: boolean;
    }
): Promise<{ input: any; ragContext?: RAGContext }> {
    if (!config.ragEnabled && !config.autoRAG) {
        return { input };
    }

    const generator = new RAGEnhancedGenerator();

    const ragContext = await generator.generateRAGContext({
        documentType,
        baseInput: input,
        userId,
        knowledgeSourceIds: config.knowledgeSourceIds,
        autoSelectSources: !config.knowledgeSourceIds?.length,
    });

    if (!ragContext) {
        return { input };
    }

    // Enhance input with RAG insights
    const enhancedInput = {
        ...input,
        _ragContext: ragContext.summary,
        _ragSources: ragContext.sources.length,
    };

    return {
        input: enhancedInput,
        ragContext,
    };
}