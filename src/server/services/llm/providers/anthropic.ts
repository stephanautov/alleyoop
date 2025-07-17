// src/server/services/llm/providers/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, CompletionParams, CompletionResponse } from '../base';
import { env } from '~/env';
import { TRPCError } from '@trpc/server';

export class AnthropicProvider implements LLMProvider {
    name = 'anthropic';
    private client: Anthropic;

    constructor(apiKey?: string) {
        const key = apiKey || env.ANTHROPIC_API_KEY;
        if (!key) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Anthropic API key not configured',
            });
        }

        this.client = new Anthropic({
            apiKey: key,
        });
    }

    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Map model names to Anthropic's naming convention
            const modelMap: Record<string, string> = {
                'claude-3-opus': 'claude-3-opus-20240229',
                'claude-3-sonnet': 'claude-3-sonnet-20240229',
                'claude-3-haiku': 'claude-3-haiku-20240307',
                'claude-2.1': 'claude-2.1',
                'claude-2': 'claude-2.0',
                'claude-instant': 'claude-instant-1.2',
            };

            const model = modelMap[params.model] || params.model || 'claude-3-sonnet-20240229';

            // Anthropic uses a different message format
            const systemMessage = params.systemPrompt || 'You are a helpful AI assistant specialized in document generation.';

            const response = await this.client.messages.create({
                model,
                system: systemMessage,
                messages: [
                    {
                        role: 'user',
                        content: params.prompt,
                    },
                ],
                temperature: params.temperature ?? 0.7,
                max_tokens: params.maxTokens || 4000,
            });

            // Extract text content from response
            const content = response.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('\n');

            // Calculate token usage
            const promptTokens = this.countTokens(systemMessage + params.prompt);
            const completionTokens = this.countTokens(content);
            const totalTokens = promptTokens + completionTokens;

            return {
                content,
                promptTokens,
                completionTokens,
                totalTokens,
                model: response.model,
            };
        } catch (error: any) {
            if (error.status === 429) {
                throw new TRPCError({
                    code: 'TOO_MANY_REQUESTS',
                    message: 'Rate limit exceeded. Please try again later.',
                });
            }

            if (error.status === 401) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid Anthropic API key',
                });
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Anthropic API error: ${error.message}`,
            });
        }
    }

    countTokens(text: string): number {
        // Anthropic's Claude models use a similar tokenization to GPT models
        // More accurate would be to use their tokenizer, but this is a good approximation
        // Claude typically uses ~3.5 characters per token
        return Math.ceil(text.length / 3.5);
    }

    estimateCost(tokens: number, model: string): number {
        // Pricing as of 2024 (per million tokens)
        const pricing: Record<string, { input: number; output: number }> = {
            'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
            'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
            'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
            'claude-2.1': { input: 8.00, output: 24.00 },
            'claude-2.0': { input: 8.00, output: 24.00 },
            'claude-instant-1.2': { input: 0.80, output: 2.40 },
        };

        const modelPricing = pricing[model] || pricing['claude-3-sonnet-20240229'];

        // Assume 60/40 split between input/output tokens
        const inputTokens = tokens * 0.6;
        const outputTokens = tokens * 0.4;

        // Convert from per million to actual cost
        return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1_000_000;
    }

    // Anthropic-specific features
    async generateWithVision(params: {
        prompt: string;
        images: Array<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }>;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse> {
        const model = params.model || 'claude-3-sonnet-20240229';

        const response = await this.client.messages.create({
            model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: params.prompt,
                        },
                        ...params.images.map(img => ({
                            type: 'image' as const,
                            source: {
                                type: 'base64' as const,
                                media_type: img.mediaType,
                                data: img.data,
                            },
                        })),
                    ],
                },
            ],
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens || 4000,
        });

        const content = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        return {
            content,
            promptTokens: response.usage?.input_tokens || 0,
            completionTokens: response.usage?.output_tokens || 0,
            totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            model: response.model,
        };
    }
}