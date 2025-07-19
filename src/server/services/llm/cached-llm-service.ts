// src/server/services/llm/cached-llm-service.ts

import { EventEmitter } from 'events';
import { DocumentType } from '@prisma/client';
import { getCacheManager, CacheManager } from '../cache/manager';
import type {
    DocumentProviderName,
    GenerateDocumentParams,
    GeneratedDocument,
    ProgressEventData
} from '../document/types';

export interface CachedLLMServiceConfig {
    provider: DocumentProviderName;
    model: string;
    temperature?: number;
    maxTokens?: number;
    useCache?: boolean;
    forceRefresh?: boolean;
}

export interface GenerationStats {
    outlineFromCache: boolean;
    sectionsFromCache: number;
    totalSections: number;
    costSaved: number;
    timeElapsed: number;
}

export class CachedLLMService extends EventEmitter {
    private cacheManager: CacheManager;
    private baseService: any; // Your existing LLM service
    private config: CachedLLMServiceConfig;
    private stats: GenerationStats;

    constructor(config: CachedLLMServiceConfig, baseService: any) {
        super();
        this.config = config;
        this.baseService = baseService;
        this.cacheManager = getCacheManager();
        this.stats = {
            outlineFromCache: false,
            sectionsFromCache: 0,
            totalSections: 0,
            costSaved: 0,
            timeElapsed: 0,
        };
    }

    /**
     * Generate document with caching
     */
    async generateDocument(params: GenerateDocumentParams): Promise<GeneratedDocument> {
        const startTime = Date.now();

        try {
            // Emit start event
            this.emitProgress({
                progress: 0,
                message: 'Starting document generation',
                phase: 'initialization'
            });

            // Check if caching is enabled and appropriate
            const shouldUseCache = this.config.useCache !== false &&
                this.cacheManager.shouldCache({
                    documentType: params.type as DocumentType,
                    hasPersonalInfo: this.hasPersonalInfo(params.input),
                    isTemplate: params.input.isTemplate || false,
                });

            // Generate outline with caching
            const outline = await this.generateOutlineWithCache(params, shouldUseCache);

            // Generate sections with caching
            const sections = await this.generateSectionsWithCache(
                params,
                outline,
                shouldUseCache
            );

            // Generate final content (not cached as it's quick)
            this.emitProgress({
                progress: 80,
                message: 'Generating final content',
                phase: 'content'
            });

            const content = await this.baseService.generateFinalContent({
                ...params,
                outline,
                sections
            });

            // Calculate stats
            this.stats.timeElapsed = Date.now() - startTime;

            // Emit completion with stats
            this.emitProgress({
                progress: 100,
                message: 'Document generation complete',
                phase: 'complete',
                metadata: {
                    stats: this.stats,
                    cacheUsed: shouldUseCache,
                }
            });

            return {
                outline: JSON.stringify(outline),
                sections,
                content,
                metadata: {
                    provider: params.provider,
                    generatedAt: new Date().toISOString(),
                    stats: this.stats,
                }
            };
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Generate outline with caching
     */
    private async generateOutlineWithCache(
        params: GenerateDocumentParams,
        useCache: boolean
    ): Promise<any> {
        if (!useCache) {
            return this.baseService.generateOutline(params);
        }

        const result = await this.cacheManager.getOrGenerateOutline(
            {
                documentType: params.type as DocumentType,
                input: params.input,
                provider: this.config.provider,
                model: this.config.model,
                userId: params.userId,
            },
            async () => {
                this.emitProgress({
                    progress: 20,
                    message: 'Generating document outline',
                    phase: 'outline'
                });

                return this.baseService.generateOutline(params);
            },
            {
                forceRefresh: this.config.forceRefresh,
                userId: params.userId,
            }
        );

        this.stats.outlineFromCache = result.fromCache;
        if (result.costSaved) {
            this.stats.costSaved += result.costSaved;
        }

        if (result.fromCache) {
            this.emitProgress({
                progress: 30,
                message: 'Outline loaded from cache',
                phase: 'outline',
                metadata: { fromCache: true }
            });
        } else {
            this.emitProgress({
                progress: 30,
                message: 'Outline generated successfully',
                phase: 'outline'
            });
        }

        return result.value;
    }

    /**
     * Generate sections with caching
     */
    private async generateSectionsWithCache(
        params: GenerateDocumentParams,
        outline: any,
        useCache: boolean
    ): Promise<Record<string, string>> {
        const sections: Record<string, string> = {};
        const sectionKeys = Object.keys(outline);
        this.stats.totalSections = sectionKeys.length;

        for (let i = 0; i < sectionKeys.length; i++) {
            const sectionKey = sectionKeys[i];
            if (!sectionKey) continue;
            const progress = 30 + (50 * (i / sectionKeys.length));

            if (!useCache) {
                this.emitProgress({
                    progress,
                    message: `Generating section: ${sectionKey}`,
                    phase: 'sections'
                });

                sections[sectionKey] = await this.baseService.generateSection({
                    ...params,
                    sectionKey,
                    outline
                });
                continue;
            }

            // Try to get from cache
            const result = await this.cacheManager.getOrGenerateSection(
                {
                    documentType: params.type as DocumentType,
                    input: params.input,
                    provider: this.config.provider,
                    model: this.config.model,
                    userId: params.userId,
                    sectionId: sectionKey,
                    outline,
                    previousSections: sections,
                },
                async () => {
                    this.emitProgress({
                        progress,
                        message: `Generating section: ${sectionKey}`,
                        phase: 'sections'
                    });

                    return this.baseService.generateSection({
                        ...params,
                        sectionKey,
                        outline,
                        previousSections: sections,
                    });
                },
                {
                    forceRefresh: this.config.forceRefresh,
                    userId: params.userId,
                }
            );

            sections[sectionKey] = result.value;

            if (result.fromCache) {
                this.stats.sectionsFromCache++;
                if (result.costSaved) {
                    this.stats.costSaved += result.costSaved;
                }

                this.emitProgress({
                    progress,
                    message: `Section loaded from cache: ${sectionKey}`,
                    phase: 'sections',
                    metadata: { fromCache: true }
                });
            } else {
                this.emitProgress({
                    progress,
                    message: `Section generated: ${sectionKey}`,
                    phase: 'sections'
                });
            }
        }

        return sections;
    }

    /**
     * Check if input contains personal information
     */
    private hasPersonalInfo(input: any): boolean {
        // Check for PII indicators
        const piiFields = [
            'ssn',
            'socialSecurityNumber',
            'dateOfBirth',
            'dob',
            'patientId',
            'medicalRecordNumber',
            'mrn',
            'phoneNumber',
            'address',
            'email',
        ];

        const checkObject = (obj: any): boolean => {
            if (!obj || typeof obj !== 'object') return false;

            for (const key of Object.keys(obj)) {
                // Check if key is a PII field
                if (piiFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                    return true;
                }

                // Recursively check nested objects
                if (typeof obj[key] === 'object') {
                    if (checkObject(obj[key])) return true;
                }
            }

            return false;
        };

        return checkObject(input);
    }

    /**
     * Emit progress event
     */
    private emitProgress(data: Partial<ProgressEventData>): void {
        this.emit('progress', {
            progress: data.progress || 0,
            message: data.message || '',
            phase: data.phase || 'unknown',
            ...data
        } as ProgressEventData);
    }

    /**
     * Get generation statistics
     */
    getStats(): GenerationStats {
        return { ...this.stats };
    }

    /**
     * Clear cache for a specific document type
     */
    async clearCache(documentType: DocumentType): Promise<void> {
        await this.cacheManager.invalidateDocumentType(documentType);
    }
}