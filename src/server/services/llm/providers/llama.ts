// src/server/services/llm/providers/llama.ts
import type { LLMProvider, CompletionParams, CompletionResponse } from '../base';
import { env } from '~/env';
import { TRPCError } from '@trpc/server';
import Replicate from 'replicate';

// Provider options for Llama models
export type LlamaProviderType = 'replicate' | 'together' | 'local' | 'groq';

export interface LlamaProviderConfig {
    provider?: LlamaProviderType;
    apiKey?: string;
    baseUrl?: string; // For local deployments
}

export class LlamaProvider implements LLMProvider {
    name = 'llama';
    private provider: LlamaProviderType;
    private apiKey?: string;
    private baseUrl?: string;
    private replicateClient?: Replicate;

    constructor(config: LlamaProviderConfig = {}) {
        this.provider = config.provider || env.LLAMA_PROVIDER || 'replicate';

        switch (this.provider) {
            case 'replicate':
                this.apiKey = config.apiKey || env.REPLICATE_API_TOKEN;
                if (!this.apiKey) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Replicate API token not configured',
                    });
                }
                this.replicateClient = new Replicate({ auth: this.apiKey });
                break;

            case 'together':
                this.apiKey = config.apiKey || env.TOGETHER_API_KEY;
                if (!this.apiKey) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Together API key not configured',
                    });
                }
                this.baseUrl = 'https://api.together.xyz/v1';
                break;

            case 'groq':
                this.apiKey = config.apiKey || env.GROQ_API_KEY;
                if (!this.apiKey) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Groq API key not configured',
                    });
                }
                this.baseUrl = 'https://api.groq.com/openai/v1';
                break;

            case 'local':
                this.baseUrl = config.baseUrl || env.LOCAL_LLAMA_URL || 'http://localhost:8080';
                break;
        }
    }

    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        switch (this.provider) {
            case 'replicate':
                return this.generateWithReplicate(params);
            case 'together':
            case 'groq':
                return this.generateWithOpenAICompatible(params);
            case 'local':
                return this.generateWithLocal(params);
            default:
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Unsupported Llama provider: ${this.provider}`,
                });
        }
    }

    private async generateWithReplicate(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Model mapping for Replicate
            const modelMap: Record<string, string> = {
                'llama-2-7b': 'meta/llama-2-7b-chat:latest',
                'llama-2-13b': 'meta/llama-2-13b-chat:latest',
                'llama-2-70b': 'meta/llama-2-70b-chat:latest',
                'llama-3-8b': 'meta/meta-llama-3-8b-instruct:latest',
                'llama-3-70b': 'meta/meta-llama-3-70b-instruct:latest',
                'codellama-7b': 'meta/codellama-7b-instruct:latest',
                'codellama-13b': 'meta/codellama-13b-instruct:latest',
                'codellama-34b': 'meta/codellama-34b-instruct:latest',
            };

            const model = modelMap[params.model] || params.model || 'meta/meta-llama-3-70b-instruct:latest';

            // Format prompt for Llama chat format
            const formattedPrompt = this.formatLlamaPrompt(params.systemPrompt, params.prompt);

            const output = await this.replicateClient!.run(
                model as `${string}/${string}:${string}`,
                {
                    input: {
                        prompt: formattedPrompt,
                        temperature: params.temperature ?? 0.7,
                        max_new_tokens: params.maxTokens || 4000,
                        top_p: 0.95,
                        repetition_penalty: 1.1,
                    },
                }
            );

            // Replicate returns output as array of strings
            const content = Array.isArray(output) ? output.join('') : String(output);

            const promptTokens = this.countTokens(formattedPrompt);
            const completionTokens = this.countTokens(content);

            return {
                content,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                model,
            };
        } catch (error: any) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Replicate API error: ${error.message}`,
            });
        }
    }

    private async generateWithOpenAICompatible(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Model names for Together/Groq
            const modelMap: Record<string, string> = {
                // Together models
                'llama-2-7b': 'togethercomputer/llama-2-7b-chat',
                'llama-2-13b': 'togethercomputer/llama-2-13b-chat',
                'llama-2-70b': 'togethercomputer/llama-2-70b-chat',
                'llama-3-8b': 'meta-llama/Llama-3-8b-chat-hf',
                'llama-3-70b': 'meta-llama/Llama-3-70b-chat-hf',
                'mixtral-8x7b': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
                // Groq models
                'llama2-70b-4096': 'llama2-70b-4096',
                'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
                'gemma-7b-it': 'gemma-7b-it',
            };

            const model = modelMap[params.model] || params.model ||
                (this.provider === 'groq' ? 'llama2-70b-4096' : 'meta-llama/Llama-3-70b-chat-hf');

            const messages = [];
            if (params.systemPrompt) {
                messages.push({ role: 'system', content: params.systemPrompt });
            }
            messages.push({ role: 'user', content: params.prompt });

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
                    top_p: 0.95,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';

            return {
                content,
                promptTokens: data.usage?.prompt_tokens || this.countTokens(params.prompt),
                completionTokens: data.usage?.completion_tokens || this.countTokens(content),
                totalTokens: data.usage?.total_tokens || 0,
                model: data.model || model,
            };
        } catch (error: any) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `${this.provider} API error: ${error.message}`,
            });
        }
    }

    private async generateWithLocal(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Local deployment using llama.cpp or similar
            const prompt = this.formatLlamaPrompt(params.systemPrompt, params.prompt);

            const response = await fetch(`${this.baseUrl}/completion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                    temperature: params.temperature ?? 0.7,
                    n_predict: params.maxTokens || 4000,
                    top_p: 0.95,
                    repeat_penalty: 1.1,
                    stop: ['</s>', '[INST]', '[/INST]'],
                }),
            });

            if (!response.ok) {
                throw new Error(`Local Llama server error: HTTP ${response.status}`);
            }

            const data = await response.json();
            const content = data.content || '';

            const promptTokens = data.tokens_evaluated || this.countTokens(prompt);
            const completionTokens = data.tokens_predicted || this.countTokens(content);

            return {
                content,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                model: data.model || 'local-llama',
            };
        } catch (error: any) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Local Llama error: ${error.message}`,
            });
        }
    }

    private formatLlamaPrompt(systemPrompt?: string, userPrompt?: string): string {
        // Llama 2 chat format
        let prompt = '<s>[INST] ';

        if (systemPrompt) {
            prompt += `<<SYS>>\n${systemPrompt}\n<</SYS>>\n\n`;
        }

        prompt += `${userPrompt} [/INST]`;

        return prompt;
    }

    countTokens(text: string): number {
        // Llama models typically use ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    estimateCost(tokens: number, model: string): number {
        // Pricing varies significantly by provider
        const pricing: Record<string, { input: number; output: number }> = {
            // Replicate (per million tokens)
            'meta/llama-2-7b-chat': { input: 0.05, output: 0.25 },
            'meta/llama-2-13b-chat': { input: 0.10, output: 0.50 },
            'meta/llama-2-70b-chat': { input: 0.65, output: 2.75 },
            'meta/meta-llama-3-8b-instruct': { input: 0.05, output: 0.25 },
            'meta/meta-llama-3-70b-instruct': { input: 0.65, output: 2.75 },

            // Together (per million tokens)
            'togethercomputer/llama-2-7b-chat': { input: 0.20, output: 0.20 },
            'togethercomputer/llama-2-13b-chat': { input: 0.225, output: 0.225 },
            'togethercomputer/llama-2-70b-chat': { input: 0.90, output: 0.90 },
            'meta-llama/Llama-3-8b-chat-hf': { input: 0.20, output: 0.20 },
            'meta-llama/Llama-3-70b-chat-hf': { input: 0.90, output: 0.90 },

            // Groq (per million tokens) - very competitive pricing
            'llama2-70b-4096': { input: 0.70, output: 0.80 },
            'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },

            // Local deployment - no API costs
            'local-llama': { input: 0, output: 0 },
        };

        const modelPricing = pricing[model] || { input: 0.50, output: 0.50 };

        // Assume 60/40 split between input/output tokens
        const inputTokens = tokens * 0.6;
        const outputTokens = tokens * 0.4;

        // Convert from per million to actual cost
        return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1_000_000;
    }

    // Llama-specific feature: Code generation optimization
    async generateCode(params: {
        prompt: string;
        language: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse> {
        const codePrompt = `You are an expert ${params.language} programmer. Generate clean, efficient, and well-commented code.\n\n${params.prompt}`;

        return this.generateCompletion({
            prompt: codePrompt,
            model: params.model || 'codellama-34b',
            temperature: params.temperature ?? 0.3, // Lower temperature for code
            maxTokens: params.maxTokens || 4000,
            systemPrompt: 'You are CodeLlama, an AI assistant specialized in generating high-quality code.',
        });
    }
}