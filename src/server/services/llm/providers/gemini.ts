// src/server/services/llm/providers/gemini.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { LLMProvider, CompletionParams, CompletionResponse } from '../base';
import { env } from '~/env';
import { TRPCError } from '@trpc/server';

export class GeminiProvider implements LLMProvider {
    name = 'gemini';
    private client: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        const key = apiKey || env.GOOGLE_AI_API_KEY || env.GEMINI_API_KEY;
        if (!key) {
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Gemini API key not configured',
            });
        }

        this.client = new GoogleGenerativeAI(key);
    }

    async generateCompletion(params: CompletionParams): Promise<CompletionResponse> {
        try {
            // Map model names to Gemini's naming convention
            const modelMap: Record<string, string> = {
                'gemini-pro': 'gemini-pro',
                'gemini-pro-vision': 'gemini-pro-vision',
                'gemini-1.5-pro': 'gemini-1.5-pro-latest',
                'gemini-1.5-flash': 'gemini-1.5-flash-latest',
                'gemini-ultra': 'gemini-ultra',
            };

            const modelName = modelMap[params.model] || params.model || 'gemini-1.5-pro-latest';
            const model = this.client.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: params.temperature ?? 0.7,
                    maxOutputTokens: params.maxTokens || 4000,
                    topP: 0.95,
                    topK: 40,
                },
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    },
                ],
            });

            // Combine system prompt and user prompt
            const fullPrompt = params.systemPrompt
                ? `${params.systemPrompt}\n\n${params.prompt}`
                : params.prompt;

            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const content = response.text();

            // Calculate token usage (Gemini doesn't provide exact counts in the same way)
            const promptTokens = this.countTokens(fullPrompt);
            const completionTokens = this.countTokens(content);
            const totalTokens = promptTokens + completionTokens;

            return {
                content,
                promptTokens,
                completionTokens,
                totalTokens,
                model: modelName,
            };
        } catch (error: any) {
            if (error.message?.includes('quota')) {
                throw new TRPCError({
                    code: 'TOO_MANY_REQUESTS',
                    message: 'API quota exceeded. Please try again later.',
                });
            }

            if (error.message?.includes('API key')) {
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'Invalid Gemini API key',
                });
            }

            if (error.message?.includes('safety')) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Content was blocked by safety filters. Please modify your request.',
                });
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Gemini API error: ${error.message}`,
            });
        }
    }

    countTokens(text: string): number {
        // Gemini uses a similar tokenization approach to other models
        // Approximately 4 characters per token
        return Math.ceil(text.length / 4);
    }

    estimateCost(tokens: number, model: string): number {
        // Gemini pricing (per 1000 tokens) - as of 2024
        const pricing: Record<string, { input: number; output: number }> = {
            'gemini-pro': { input: 0.0005, output: 0.0015 }, // $0.50/$1.50 per million
            'gemini-1.5-pro-latest': { input: 0.0035, output: 0.0105 }, // $3.50/$10.50 per million
            'gemini-1.5-flash-latest': { input: 0.00035, output: 0.00105 }, // $0.35/$1.05 per million
            'gemini-ultra': { input: 0.0125, output: 0.0375 }, // Estimated pricing
        };

        const modelPricing = pricing[model] || pricing['gemini-1.5-pro-latest'];

        // Assume 60/40 split between input/output tokens
        const inputTokens = tokens * 0.6;
        const outputTokens = tokens * 0.4;

        // Convert from per 1000 to actual cost
        return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1000;
    }

    // Gemini-specific features
    async generateWithContext(params: {
        prompt: string;
        context: string[];
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse> {
        const modelName = params.model || 'gemini-1.5-pro-latest';
        const model = this.client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: params.temperature ?? 0.7,
                maxOutputTokens: params.maxTokens || 4000,
            },
        });

        // Build a multi-turn conversation
        const chat = model.startChat({
            history: params.context.map((content, index) => ({
                role: index % 2 === 0 ? 'user' : 'model',
                parts: [{ text: content }],
            })),
        });

        const result = await chat.sendMessage(params.prompt);
        const response = await result.response;
        const content = response.text();

        // Calculate approximate tokens
        const allText = [...params.context, params.prompt, content].join(' ');
        const totalTokens = this.countTokens(allText);
        const promptTokens = totalTokens - this.countTokens(content);
        const completionTokens = this.countTokens(content);

        return {
            content,
            promptTokens,
            completionTokens,
            totalTokens,
            model: modelName,
        };
    }

    async generateWithVision(params: {
        prompt: string;
        images: Array<{ data: string; mimeType: string }>;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<CompletionResponse> {
        const modelName = params.model || 'gemini-pro-vision';
        const model = this.client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: params.temperature ?? 0.7,
                maxOutputTokens: params.maxTokens || 4000,
            },
        });

        const imageParts = params.images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data,
            },
        }));

        const result = await model.generateContent([params.prompt, ...imageParts]);
        const response = await result.response;
        const content = response.text();

        const promptTokens = this.countTokens(params.prompt) + (params.images.length * 250); // Estimate for images
        const completionTokens = this.countTokens(content);

        return {
            content,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            model: modelName,
        };
    }
}