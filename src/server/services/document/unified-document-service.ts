// src/server/services/document/unified-document-service.ts
// COMPLETE FIXED VERSION

import { type PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { LLMService, type LLMServiceConfig } from '../llm';
import { DOCUMENT_PROMPTS, type DocumentPrompts } from '../llm/prompts';
import { type DocumentType } from '@prisma/client';
import { getCacheService, CacheType } from '../cache';
import { getCacheManager } from '../cache/manager';
import { RAGService } from '../rag';
import { PreferencesSyncService } from '../preferences/sync';
import { getIO } from '~/server/websocket';
import { Redis } from 'ioredis';
import { env } from '~/env';
import { EventEmitter } from 'events';
import { type GenerateDocumentParams, type GeneratedDocument, type DocumentProviderName, type ToneType, type ProgressEventData, type SectionData } from './types';
import { enhanceWithRAG, type RAGContext } from './rag-enhanced-generation';

// LLM Service Wrapper to add EventEmitter capabilities
class LLMServiceWrapper extends EventEmitter {
    constructor(private llmService: LLMService) {
        super();
    }

    async generateDocument(params: any): Promise<any> {
        const documentId = params.config?.documentId;

        // Emit initial progress
        this.emit('progress', {
            documentId,
            stage: 'initializing',
            progress: 0,
            message: 'Starting document generation...'
        });

        try {
            // Call the actual LLM service method
            // Adjust this based on your actual LLMService API
            const result = await this.llmService.generate(params);

            // Emit completion
            this.emit('progress', {
                documentId,
                stage: 'complete',
                progress: 100,
                message: 'Document generation complete'
            });

            return result;
        } catch (error) {
            this.emit('error', { documentId, error });
            throw error;
        }
    }
}

export interface UnifiedGenerationOptions {
    userId: string;
    type: DocumentType;
    input: any;
    title: string;
    // Optional overrides
    provider?: DocumentProviderName;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    useCache?: boolean;
    useRAG?: boolean;
    ragEnabled?: boolean;
    knowledgeSourceIds?: string[];
    autoSelectSources?: boolean;
    ragConfig?: {
        maxResults?: number;
        minSimilarity?: number;
        includeMetadata?: boolean;
    };
    forceRegenerate?: boolean;
}

export interface GenerationResult {
    documentId: string;
    content: string;
    provider: DocumentProviderName;
    model: string;
    cost: number;
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
    cached: boolean;
    ragContext?: any;
}

export class UnifiedDocumentService {
    private llmService: LLMService;
    private cacheService: ReturnType<typeof getCacheService>;
    private cacheManager: ReturnType<typeof getCacheManager>;
    private ragService: RAGService;
    private redis: Redis;

    constructor(
        private db: PrismaClient,
        config?: Partial<LLMServiceConfig>
    ) {
        this.llmService = new LLMService(config);
        this.cacheService = getCacheService(); // No arguments
        this.cacheManager = getCacheManager();
        this.ragService = new RAGService(db);
        this.redis = new Redis(env.REDIS_URL);
    }

    /**
     * Generate a document with unified preferences and prompts
     */
    async generate(options: UnifiedGenerationOptions): Promise<GenerationResult> {
        // 1. Validate user and check cost limits
        await this.validateGeneration(options.userId);

        // 2. Get user preferences
        const preferences = await this.getUserPreferences(options.userId);

        // 3. Determine final configuration
        const config = await this.buildConfiguration(options, preferences);

        // 4. Check cache if enabled
        if (config.useCache && !options.forceRegenerate) {
            const cached = await this.checkCache(config);
            if (cached) {
                return cached;
            }
        }

        // 5. Get RAG context if enabled
        let ragContext: RAGContext | undefined;
        let enhancedInput = options.input;

        if (config.useRAG || options.ragEnabled) {
            console.log('[Document Service] Enhancing with RAG context...');

            const ragResult = await enhanceWithRAG(
                options.type,
                options.input,
                options.userId,
                {
                    ragEnabled: true,
                    knowledgeSourceIds: options.knowledgeSourceIds,
                    autoRAG: options.autoSelectSources,
                }
            );

            if (ragResult.ragContext) {
                ragContext = ragResult.ragContext;
                enhancedInput = ragResult.input;

                console.log(`[Document Service] Found ${ragContext.sources.length} relevant sources`);

                // Emit RAG context found event
                this.emit('rag:context', {
                    documentId: document.id,
                    sourceCount: ragContext.sources.length,
                    summary: ragContext.summary,
                });
            }
        }

        // 6. Create document record
        const document = await this.createDocument(options, config, ragContext);

        // 7. Generate content with progress tracking
        try {
            const result = await this.generateWithProgress(
                document.id,
                config,
                enhancedInput, // Use enhanced input instead of original
                ragContext
            );

            // 8. Cache successful generation
            if (config.useCache) {
                await this.cacheResult(config, result);
            }

            // 9. Update document with final content
            await this.updateDocument(document.id, result);

            return {
                documentId: document.id,
                ...result,
                cached: false,
            };
        } catch (error) {
            await this.handleGenerationError(document.id, error, config);
            throw error;
        }
    }

    /**
     * Validate user can generate documents
     */
    private async validateGeneration(userId: string): Promise<void> {
        const costCheck = await PreferencesSyncService.checkCostLimit(userId);
        if (!costCheck.allowed) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: costCheck.reason || 'Cost limit exceeded',
            });
        }
    }

    /**
     * Get user preferences with defaults
     */
    private async getUserPreferences(userId: string) {
        const prefs = await this.db.userPreferences.findUnique({
            where: { userId },
        });

        if (!prefs) {
            // Create default preferences
            return await PreferencesSyncService.ensureUserPreferences(userId);
        }

        return prefs;
    }

    /**
     * Build final configuration merging options and preferences
     */
    private async buildConfiguration(
        options: UnifiedGenerationOptions,
        preferences: any
    ) {
        // Get document type specific preferences
        const providerModels = preferences.providerModels as Record<string, any> || {};
        const docTypePrefs = providerModels[options.type] || {};

        // Determine provider and model with proper typing
        const provider = (options.provider ||
            docTypePrefs.provider ||
            preferences.defaultProvider ||
            'openai') as DocumentProviderName;

        const model = options.model ||
            docTypePrefs.model ||
            this.getDefaultModel(provider);

        // Get the appropriate prompts for this provider
        const prompts = DOCUMENT_PROMPTS[options.type];
        if (!prompts) {
            throw new Error(`No prompts defined for document type: ${options.type}`);
        }

        // Type-safe provider access
        const providerPrompts = (prompts as any)[provider] ?? Object.values(prompts)[0];

        // Apply user's system prompt style
        const systemPrompt = this.applyPromptStyle(
            providerPrompts.systemPrompt,
            preferences.systemPromptStyle || 'professional'
        );

        return {
            provider,
            model,
            temperature: options.temperature ?? preferences.temperature ?? 0.7,
            maxTokens: options.maxTokens ?? preferences.maxTokensOverride ?? null,
            useCache: options.useCache ?? preferences.cacheEnabled ?? true,
            useRAG: options.useRAG ?? preferences.ragEnabled ?? false,
            ragThreshold: preferences.autoRAGThreshold ?? 0.7,
            systemPrompt,
            prompts: providerPrompts,
            documentType: options.type,
            input: options.input,
            userId: options.userId,
            preferSpeed: preferences.preferSpeed || false,
            allowFallback: preferences.allowFallback || true,
        };
    }

    /**
     * Apply user's preferred prompt style
     */
    private applyPromptStyle(basePrompt: string, style: string): string {
        const styleModifiers: Record<string, string> = {
            professional: 'Maintain a professional, formal tone throughout.',
            creative: 'Use creative and engaging language while maintaining accuracy.',
            technical: 'Use precise technical terminology and detailed explanations.',
            conversational: 'Write in a friendly, conversational tone.',
            academic: 'Follow academic writing standards with proper citations.',
        };

        const modifier = styleModifiers[style] || styleModifiers.professional;
        return `${basePrompt}\n\nWriting Style: ${modifier}`;
    }

    /**
     * Check cache for existing generation
     */
    private async checkCache(config: any): Promise<GenerationResult | null> {
        const cacheKey = this.cacheService.generateKey({
            type: CacheType.DOCUMENT,
            documentType: config.documentType,
            input: config.input,
            provider: config.provider,
            model: config.model,
        });

        const cached = await this.cacheService.get<GenerationResult>(cacheKey);

        if (cached) {
            // Emit cache hit event
            const io = getIO();
            io.to(`user:${config.userId}`).emit('cache:hit', {
                documentType: config.documentType,
                provider: config.provider,
                savedCost: cached.metadata.costSaved || 0,
            });

            return {
                ...cached.value,
                cached: true,
            };
        }

        return null;
    }

    /**
     * Get RAG context for generation
     */
    private async getRAGContext(config: any, options: UnifiedGenerationOptions) {
        const io = getIO();
        const progressKey = `progress:rag:${options.userId}:${Date.now()}`;

        try {
            // Emit RAG start
            io.to(`user:${config.userId}`).emit('rag:start', {
                documentType: config.documentType,
            });

            // Build search query from input
            const searchQuery = this.buildRAGQuery(options.type, options.input);

            // Retrieve context
            const context = await this.ragService.retrieveContext(
                searchQuery,
                config.userId,
                {
                    sourceIds: options.knowledgeSourceIds,
                    threshold: config.ragThreshold,
                    limit: 5,
                }
            );

            // Emit RAG complete
            io.to(`user:${config.userId}`).emit('rag:complete', {
                sourcesUsed: context.sources.length,
                totalTokens: context.totalTokens,
            });

            return context;
        } catch (error) {
            console.error('RAG context retrieval failed:', error);
            // Continue without RAG if it fails
            return null;
        }
    }

    /**
     * Build RAG search query from document input
     */
    private buildRAGQuery(type: DocumentType, input: any): string {
        switch (type) {
            case 'BIOGRAPHY':
                return `${input.name} ${input.profession} ${input.achievements?.join(' ')}`;
            case 'CASE_SUMMARY':
                return `${input.caseTitle} ${input.legalIssues} ${input.parties}`;
            case 'BUSINESS_PLAN':
                return `${input.business.name} ${input.industry} ${input.products}`;
            case 'GRANT_PROPOSAL':
                return `${input.title} ${input.organization} ${input.objectives}`;
            case 'MEDICAL_REPORT':
                return `${input.patientCondition} ${input.symptoms} ${input.diagnosis}`;
            default:
                return JSON.stringify(input).slice(0, 500);
        }
    }

    /**
     * Create document record in database
     */
    private async createDocument(
        options: UnifiedGenerationOptions,
        config: any,
        ragContext?: RAGContext
    ): Promise<any> {
        return await this.db.document.create({
            data: {
                userId: options.userId,
                title: options.title,
                type: options.type,
                status: 'PENDING',
                input: options.input,
                provider: config.provider,
                model: config.model,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                // Use ragContext instead of ragEnabled
                ragEnabled: !!ragContext,
                ragContext: ragContext ? {
                    sourceCount: ragContext.sources.length,
                    sourceIds: ragContext.sources.map(s => s.id),
                    summary: ragContext.summary,
                } : null,
            },
        });
    }

    /**
     * Generate document with progress tracking
     */
    private async generateWithProgress(
        documentId: string,
        input: any, // This is now the enhanced input
        ragContext?: RAGContext
    ): Promise<any> {
        const io = getIO();
        const progressKey = `progress:document:${documentId}`;

        // Initialize progress
        await this.redis.set(
            progressKey,
            JSON.stringify({
                stage: 'initializing',
                progress: 0,
                message: 'Preparing document generation...',
                startedAt: Date.now(),
            }),
            'EX',
            3600
        );

        // Create wrapped LLM service with event emitter
        const wrappedLLMService = new LLMServiceWrapper(this.llmService);

        // Subscribe to LLM progress events
        wrappedLLMService.on('progress', async (data: ProgressEventData) => {
            if (data.documentId === documentId) {
                const progress = {
                    stage: data.stage,
                    progress: data.progress,
                    message: data.message,
                    currentSection: data.currentSection,
                    estimatedTimeRemaining: data.estimatedTimeRemaining,
                };

                // Store in Redis
                await this.redis.set(progressKey, JSON.stringify(progress), 'EX', 3600);

                // Broadcast to user
                io.to(`document:${documentId}`).emit('generation:progress', progress);
                io.to(`user:${config.userId}`).emit('generation:progress', {
                    documentId,
                    ...progress,
                });
            }
        });

        try {
            // Build final prompt with RAG context if available
            let finalPrompt = config.prompts;
            if (ragContext && ragContext.sources.length > 0) {
                const ragSystemPrompt = this.buildRAGSystemPrompt(
                    config.systemPrompt,
                    ragContext,
                    config.documentType
                );

                finalPrompt = {
                    ...config.prompts,
                    systemPrompt: ragSystemPrompt,
                };
                if (ragContext.relevantSections) {
                    finalPrompt.sectionContext = ragContext.relevantSections;
                }
            }

            // Generate document
            const result = await wrappedLLMService.generateDocument({
                type: config.documentType,
                provider: config.provider,
                model: config.model,
                prompts: finalPrompt,
                input: config.input,
                config: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                },
                userId: config.userId,
                documentId,
                onProgress: (progress) => this.handleProgress(documentId, progress)
            });

            // Add RAG context to result
            if (ragContext) {
                result.ragContext = {
                    sourcesUsed: ragContext.sources.map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        similarity: s.similarity,
                    })),
                    totalTokens: ragContext.totalTokens,
                };
            }

            return result;
        } catch (error) {
            console.error('Document generation failed:', error);
            throw new Error('Document generation failed');
        } finally {
            // Cleanup progress
            await this.redis.del(progressKey);
            wrappedLLMService.removeAllListeners('progress');
        }
    }

    /**
     * Cache successful generation
     */
    private async cacheResult(config: any, result: any): Promise<void> {
        const cacheKey = this.cacheService.generateKey({
            type: CacheType.DOCUMENT,
            documentType: config.documentType,
            input: config.input,
            provider: config.provider,
            model: config.model,
        });

        await this.cacheService.set({
            key: cacheKey,
            value: result,
            type: CacheType.DOCUMENT,
            documentType: config.documentType,
            provider: config.provider,
            model: config.model,
            inputHash: cacheKey.split(':').pop() || '',
            cost: result.cost || 0,
            userId: config.userId,
            documentId: result.documentId,
        });
    }

    private buildRAGSystemPrompt(
        basePrompt: string,
        ragContext: RAGContext,
        documentType: string
    ): string {
        let enhancedPrompt = basePrompt;

        // Add general RAG instructions
        enhancedPrompt += `\n\nYou have access to the following relevant information from the user's knowledge base:\n\n`;

        // Add source summaries
        ragContext.sources.forEach((source, index) => {
            enhancedPrompt += `[Source ${index + 1}: ${source.name}]\n`;
            enhancedPrompt += `${source.content}\n\n`;
        });

        // Add instructions for using the context
        enhancedPrompt += `Please incorporate relevant information from these sources naturally into the document. `;
        enhancedPrompt += `Ensure the information is accurate and properly integrated. `;
        enhancedPrompt += `If the sources contain conflicting information, use the most relevant and reliable content.\n`;

        return enhancedPrompt;
    }

    async checkRAGAvailability(userId: string): Promise<{
        available: boolean;
        sourceCount: number;
        message?: string;
    }> {
        const sources = await this.db.knowledgeSource.count({
            where: {
                userId,
                status: 'COMPLETED',
            },
        });

        return {
            available: sources > 0,
            sourceCount: sources,
            message: sources === 0
                ? 'Upload knowledge sources to enable RAG enhancement'
                : undefined,
        };
    }



    /**
     * Update document with generated content
     */
    private async updateDocument(documentId: string, result: any): Promise<void> {
        await this.db.document.update({
            where: { id: documentId },
            data: {
                status: 'COMPLETED',
                // Use sections field for content
                sections: result.sections || { fullContent: result.content },
                outline: result.outline || {},
                ragContext: result.ragContext,
                completedAt: new Date(),
                wordCount: result.content ? result.content.split(/\s+/).length : 0,
                // Update token and cost fields
                promptTokens: result.tokenUsage?.prompt || 0,
                completionTokens: result.tokenUsage?.completion || 0,
                totalCost: result.cost || 0,
            },
        });

        // Check and send cost alerts
        const doc = await this.db.document.findUnique({
            where: { id: documentId },
            select: { userId: true },
        });

        if (doc) {
            void PreferencesSyncService.checkAndSendCostAlert(doc.userId);
        }
    }

    /**
     * Handle generation errors with fallback
     */
    private async handleGenerationError(
        documentId: string,
        error: any,
        config: any
    ): Promise<void> {
        const io = getIO();

        // Update document status with error info
        await this.db.document.update({
            where: { id: documentId },
            data: {
                status: 'FAILED',
                error: error.message || 'Unknown error occurred',
                failedAt: new Date(),
                // Store provider info in appropriate fields
                provider: config.provider,
                model: config.model,
            },
        });

        // Emit error event
        io.to(`document:${documentId}`).emit('generation:error', {
            documentId,
            error: error.message,
            canRetry: config.allowFallback,
        });

        // TODO: Implement automatic fallback to alternative provider
        if (config.allowFallback && this.isRetryableError(error)) {
            // Queue for retry with different provider
            console.log('Would retry with fallback provider');
        }
    }

    /**
     * Check if error is retryable
     */
    private isRetryableError(error: any): boolean {
        const retryableErrors = [
            'rate_limit_exceeded',
            'model_not_available',
            'timeout',
            'service_unavailable',
        ];

        return retryableErrors.some(e =>
            error.message?.toLowerCase().includes(e) ||
            error.code?.toLowerCase().includes(e)
        );
    }

    /**
     * Get default model for provider
     */
    private getDefaultModel(provider: DocumentProviderName): string {
        const defaults: Record<DocumentProviderName, string> = {
            openai: 'gpt-4-turbo-preview',
            anthropic: 'claude-3-opus-20240229',
            gemini: 'gemini-1.5-pro',
            perplexity: 'llama-3-sonar-large-32k-online',
            llama: 'llama-3-70b',
        };

        return defaults[provider] || 'gpt-4-turbo-preview';
    }
}

export async function getRAGStatus(
    userId: string,
    documentType: DocumentType
): Promise<{
    enabled: boolean;
    availableSources: number;
    suggestedQueries: string[];
}> {
    const db = (await import('~/server/db')).db;

    const sources = await db.knowledgeSource.findMany({
        where: {
            userId,
            status: 'COMPLETED',
        },
        select: {
            id: true,
            name: true,
            tags: true,
        },
    });

    // Generate suggested queries based on document type
    const suggestedQueries: string[] = [];

    switch (documentType) {
        case 'BIOGRAPHY':
            suggestedQueries.push('personal history', 'achievements', 'career highlights');
            break;
        case 'BUSINESS_PLAN':
            suggestedQueries.push('market analysis', 'competitor research', 'financial data');
            break;
        case 'GRANT_PROPOSAL':
            suggestedQueries.push('research data', 'impact studies', 'methodology');
            break;
    }

    return {
        enabled: sources.length > 0,
        availableSources: sources.length,
        suggestedQueries,
    };
}