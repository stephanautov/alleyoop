// src/server/services/llm/providers/perplexity.ts
import type { LLMProvider, CompletionParams, CompletionResponse } from '../base';
import { env } from '~/env';
import { TRPCError } from '@trpc/server';

interface PerplexityMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface PerplexityResponse {
    id: string;
    model: string;
    created: number;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    citations?: string[];
}

export class PerplexityProvider implements LLMProvider {
    name = 'perplexity';
    private apiKey: string;
    private baseUrl = 'https://api.perplexity.ai';

    constructor(apiKey?: string) {
        const key = apiKey || env.PERPLEXITY_API_KEY;
        if (!key) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Perplexity API key not configured',
            });
        }
        this.apiKey = key;
    }

    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Perplexity models include online models with web search
            const modelMap: Record<string, string> = {
                'sonar-small': 'llama-3-sonar-small-32k-online',
                'sonar-medium': 'llama-3-sonar-medium-32k-online',
                'sonar-large': 'llama-3-sonar-large-32k-online',
                'chat-small': 'llama-3-sonar-small-32k-chat',
                'chat-large': 'llama-3-sonar-large-32k-chat',
                'codellama': 'codellama-70b-instruct',
                'mixtral': 'mixtral-8x7b-instruct',
            };

            const model = modelMap[params.model] || params.model || 'llama-3-sonar-large-32k-online';

            const messages: PerplexityMessage[] = [];

            if (params.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: params.systemPrompt,
                });
            }

            messages.push({
                role: 'user',
                content: params.prompt,
            });

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: params.temperature ?? 0.7,
                    max_tokens: params.maxTokens || 4000,
                    top_p: 0.9,
                    return_citations: true, // Perplexity's special feature
                    search_domain_filter: [], // Can limit search to specific domains
                    search_recency_filter: 'month', // Focus on recent information
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data: PerplexityResponse = await response.json();
            const content = data.choices[0]?.message?.content || '';

            // If citations are provided, append them to the content
            let finalContent = content;
            if (data.citations && data.citations.length > 0) {
                finalContent += '\n\n**Sources:**\n';
                data.citations.forEach((citation, index) => {
                    finalContent += `${index + 1}. ${citation}\n`;
                });
            }

            return {
                content: finalContent,
                promptTokens: data.usage?.prompt_tokens || this.countTokens(params.prompt),
                completionTokens: data.usage?.completion_tokens || this.countTokens(content),
                totalTokens: data.usage?.total_tokens || 0,
                model: data.model,
            };
        } catch (error: any) {
            if (error.message?.includes('rate limit')) {
                throw new TRPCError({
                    code: 'TOO_MANY_REQUESTS',
                    message: 'Rate limit exceeded. Please try again later.',
                });
            }

            if (error.message?.includes('401') || error.message?.includes('api_key')) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid Perplexity API key',
                });
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Perplexity API error: ${error.message}`,
            });
        }
    }

    countTokens(text: string): number {
        // Perplexity uses Llama-based models, which typically use ~3.8 characters per token
        return Math.ceil(text.length / 3.8);
    }

    estimateCost(tokens: number, model: string): number {
        // Perplexity pricing (per million tokens) - as of 2024
        const pricing: Record<string, { input: number; output: number }> = {
            'llama-3-sonar-small-32k-online': { input: 0.20, output: 0.20 },
            'llama-3-sonar-medium-32k-online': { input: 0.60, output: 0.60 },
            'llama-3-sonar-large-32k-online': { input: 1.00, output: 1.00 },
            'llama-3-sonar-small-32k-chat': { input: 0.20, output: 0.20 },
            'llama-3-sonar-large-32k-chat': { input: 1.00, output: 1.00 },
            'codellama-70b-instruct': { input: 1.00, output: 1.00 },
            'mixtral-8x7b-instruct': { input: 0.60, output: 0.60 },
        };

        const modelPricing = pricing[model] || { input: 1.00, output: 1.00 };

        // Assume 60/40 split between input/output tokens
        const inputTokens = tokens * 0.6;
        const outputTokens = tokens * 0.4;

        // Convert from per million to actual cost
        return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1_000_000;
    }

    // Perplexity-specific features for enhanced search
    async generateWithSearch(params: {
        prompt: string;
        searchDomains?: string[];
        searchRecency?: 'day' | 'week' | 'month' | 'year';
        returnImages?: boolean;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse & { images?: string[] }> {
        const model = params.model || 'llama-3-sonar-large-32k-online';

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'user',
                        content: params.prompt,
                    },
                ],
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens || 4000,
                return_citations: true,
                return_images: params.returnImages || false,
                search_domain_filter: params.searchDomains || [],
                search_recency_filter: params.searchRecency || 'month',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data: PerplexityResponse & { images?: string[] } = await response.json();
        const content = data.choices[0]?.message?.content || '';

        // Format with citations
        let finalContent = content;
        if (data.citations && data.citations.length > 0) {
            finalContent += '\n\n**Sources:**\n';
            data.citations.forEach((citation, index) => {
                finalContent += `[${index + 1}] ${citation}\n`;
            });
        }

        return {
            content: finalContent,
            promptTokens: data.usage?.prompt_tokens || this.countTokens(params.prompt),
            completionTokens: data.usage?.completion_tokens || this.countTokens(content),
            totalTokens: data.usage?.total_tokens || 0,
            model: data.model,
            images: data.images,
        };
    }
}