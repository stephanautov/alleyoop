// src/server/services/document/unified-document-service.ts

import { type PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { LLMService, type LLMServiceConfig, type ProviderName } from '../llm';
import { DOCUMENT_PROMPTS, type DocumentPrompts } from '~/config/prompts';
import { type DocumentType } from '@prisma/client';
import { CacheService } from '../cache';
import { RAGService } from '../rag';
import { PreferencesSyncService } from '../preferences/sync';
import { getIO } from '~/server/websocket';
import { Redis } from 'ioredis';
import { env } from '~/env';

export interface UnifiedGenerationOptions {
    userId: string;
    type: DocumentType;
    input: any;
    title: string;
    // Optional overrides
    provider?: ProviderName;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    useCache?: boolean;
    useRAG?: boolean;
    ragSourceIds?: string[];
    forceRegenerate?: boolean;
}

export interface GenerationResult {
    documentId: string;
    content: string;
    provider: ProviderName;
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
    private cacheService: CacheService;
    private ragService: RAGService;
    private redis: Redis;

    constructor(
        private db: PrismaClient,
        config?: Partial<LLMServiceConfig>
    ) {
        this.llmService = new LLMService(config);
        this.cacheService = new CacheService(db);
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
        let ragContext: any;
        if (config.useRAG) {
            ragContext = await this.getRAGContext(config, options);
        }

        // 6. Create document record
        const document = await this.createDocument(options, config);

        // 7. Generate content with progress tracking
        try {
            const result = await this.generateWithProgress(document.id, config, ragContext);

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

        // Determine provider and model
        const provider = options.provider ||
            docTypePrefs.provider ||
            preferences.defaultProvider ||
            'openai';

        const model = options.model ||
            docTypePrefs.model ||
            this.getDefaultModel(provider);

        // Get the appropriate prompts for this provider
        const prompts = DOCUMENT_PROMPTS[options.type];
        const providerPrompts = prompts[provider] || prompts.openai;

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
        const styleModifiers = {
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
            type: config.documentType,
            input: config.input,
            provider: config.provider,
            model: config.model,
            systemPromptStyle: config.systemPrompt,
        });

        const cached = await this.cacheService.get(cacheKey, config.userId);

        if (cached) {
            // Emit cache hit event
            const io = getIO();
            io.to(`user:${config.userId}`).emit('cache:hit', {
                documentType: config.documentType,
                provider: config.provider,
                savedCost: cached.estimatedCost || 0,
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
                    sourceIds: options.ragSourceIds,
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
                return `${input.businessName} ${input.industry} ${input.products}`;
            case 'GRANT_PROPOSAL':
                return `${input.projectTitle} ${input.organization} ${input.objectives}`;
            case 'MEDICAL_REPORT':
                return `${input.patientCondition} ${input.symptoms} ${input.diagnosis}`;
            default:
                return JSON.stringify(input).slice(0, 500);
        }
    }

    /**
     * Create document record in database
     */
    private async createDocument(options: UnifiedGenerationOptions, config: any) {
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
                ragEnabled: config.useRAG,
                metadata: {
                    preferences: {
                        systemPromptStyle: config.systemPrompt,
                        preferSpeed: config.preferSpeed,
                        cacheEnabled: config.useCache,
                    },
                },
            },
        });
    }

    /**
     * Generate document with progress tracking
     */
    private async generateWithProgress(
        documentId: string,
        config: any,
        ragContext?: any
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

        // Subscribe to LLM progress events
        this.llmService.on('progress', async (data) => {
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
                finalPrompt = {
                    ...config.prompts,
                    systemPrompt: this.ragService.buildRAGPrompt(
                        config.systemPrompt,
                        ragContext,
                        { includeSourceNames: true }
                    ),
                };
            }

            // Generate document
            const result = await this.llmService.generateDocument({
                type: config.documentType,
                provider: config.provider,
                model: config.model,
                prompts: finalPrompt,
                input: config.input,
                config: {
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                    documentId,
                },
            });

            // Add RAG context to result
            if (ragContext) {
                result.ragContext = {
                    sourcesUsed: ragContext.sources.map(s => ({
                        id: s.id,
                        name: s.name,
                        similarity: s.similarity,
                    })),
                    totalTokens: ragContext.totalTokens,
                };
            }

            return result;
        } finally {
            // Cleanup progress
            await this.redis.del(progressKey);
            this.llmService.removeAllListeners('progress');
        }
    }

    /**
     * Cache successful generation
     */
    private async cacheResult(config: any, result: any): Promise<void> {
        const cacheKey = this.cacheService.generateKey({
            type: config.documentType,
            input: config.input,
            provider: config.provider,
            model: config.model,
            systemPromptStyle: config.systemPrompt,
        });

        await this.cacheService.set(cacheKey, {
            value: result,
            provider: config.provider,
            model: config.model,
            userId: config.userId,
            documentType: config.documentType,
            estimatedCost: result.cost,
        });
    }

    /**
     * Update document with generated content
     */
    private async updateDocument(documentId: string, result: any): Promise<void> {
        await this.db.document.update({
            where: { id: documentId },
            data: {
                status: 'COMPLETED',
                content: result.content,
                output: result.sections || {},
                ragContext: result.ragContext,
                completedAt: new Date(),
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

        // Update document status
        await this.db.document.update({
            where: { id: documentId },
            data: {
                status: 'FAILED',
                metadata: {
                    error: error.message,
                    provider: config.provider,
                    model: config.model,
                },
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
    private getDefaultModel(provider: ProviderName): string {
        const defaults: Record<ProviderName, string> = {
            openai: 'gpt-4-turbo-preview',
            anthropic: 'claude-3-opus-20240229',
            gemini: 'gemini-1.5-pro',
            perplexity: 'llama-3-sonar-large-32k-online',
            llama: 'llama-3-70b',
        };

        return defaults[provider] || 'gpt-4-turbo-preview';
    }
}