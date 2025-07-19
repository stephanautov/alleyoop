// src/server/services/llm/index.ts
import type { LLMProvider, GenerationProgress } from './base';
import { OpenAIProvider } from './providers/openai';
import { DocumentType } from '@prisma/client';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { EventEmitter } from 'events';

export interface LLMServiceConfig {
    provider?: 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
}

export class LLMService {
    private provider: LLMProvider;
    private progressEmitter = new EventEmitter();

    constructor(config: LLMServiceConfig = {}) {
        switch (config.provider || 'openai') {
            case 'openai':
                this.provider = new OpenAIProvider(config.apiKey);
                break;
            // case 'anthropic':
            //   this.provider = new AnthropicProvider(config.apiKey);
            //   break;
            default:
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Invalid LLM provider',
                });
        }
    }

    async generateOutline(params: {
        type: DocumentType;
        input: any;
        onProgress?: (progress: GenerationProgress) => void;
    }): Promise<any> {
        this.emitProgress({
            stage: 'outline',
            progress: 10,
            message: 'Generating document outline...',
        }, params.onProgress);

        const prompt = this.buildOutlinePrompt(params.type, params.input);

        const response = await this.provider.generateCompletion({
            prompt,
            model: 'gpt-4-turbo-preview',
            temperature: 0.7,
            systemPrompt: 'You are an expert document writer. Generate a detailed outline in JSON format.',
        });

        this.emitProgress({
            stage: 'outline',
            progress: 30,
            message: 'Outline generated successfully',
        }, params.onProgress);

        try {
            return JSON.parse(response.content);
        } catch {
            // If JSON parsing fails, return structured outline
            return this.parseOutlineFromText(response.content);
        }
    }

    async generateSections(params: {
        outline: any;
        type: DocumentType;
        input: any;
        onProgress?: (progress: GenerationProgress) => void;
    }): Promise<Record<string, string>> {
        const sections: Record<string, string> = {};
        const totalSections = Object.keys(params.outline).length;
        let completedSections = 0;

        for (const [sectionId, sectionOutline] of Object.entries(params.outline)) {
            this.emitProgress({
                stage: 'sections',
                progress: 30 + (completedSections / totalSections) * 50,
                message: `Generating section: ${sectionId}`,
                currentSection: sectionId,
            }, params.onProgress);

            const prompt = this.buildSectionPrompt(
                params.type,
                sectionId,
                sectionOutline,
                params.input
            );

            const response = await this.provider.generateCompletion({
                prompt,
                model: 'gpt-4-turbo-preview',
                temperature: 0.7,
                maxTokens: 2000,
            });

            sections[sectionId] = response.content;
            completedSections++;
        }

        return sections;
    }

    async refineDocument(params: {
        sections: Record<string, string>;
        type: DocumentType;
        requirements: any;
    }): Promise<{ content: string; metadata: any }> {
        this.emitProgress({
            stage: 'refinement',
            progress: 85,
            message: 'Refining and finalizing document...',
        });

        // Combine sections into a cohesive document
        const combinedContent = Object.entries(params.sections)
            .map(([id, content]) => content)
            .join('\n\n');

        // Optional: Run a final refinement pass
        const refinementPrompt = this.buildRefinementPrompt(
            params.type,
            combinedContent,
            params.requirements
        );

        const response = await this.provider.generateCompletion({
            prompt: refinementPrompt,
            model: 'gpt-4-turbo-preview',
            temperature: 0.3, // Lower temperature for refinement
        });

        this.emitProgress({
            stage: 'complete',
            progress: 100,
            message: 'Document generation complete!',
        });

        return {
            content: response.content,
            metadata: {
                wordCount: response.content.split(/\s+/).length,
                sections: Object.keys(params.sections),
                generatedAt: new Date(),
            },
        };
    }

    async estimateCost(input: any): Promise<{
        estimatedTokens: number;
        estimatedCost: number;
        breakdown: {
            outline: number;
            sections: number;
            refinement: number;
        };
    }> {
        // Estimate based on input complexity and document type
        const inputText = JSON.stringify(input);
        const baseTokens = this.provider.countTokens(inputText);

        const breakdown = {
            outline: baseTokens * 2,
            sections: baseTokens * 10,
            refinement: baseTokens * 3,
        };

        const totalTokens = Object.values(breakdown).reduce((a, b) => a + b, 0);
        const estimatedCost = this.provider.estimateCost(totalTokens, 'gpt-4-turbo-preview');

        return {
            estimatedTokens: totalTokens,
            estimatedCost,
            breakdown,
        };
    }

    private buildOutlinePrompt(type: DocumentType, input: any): string {
        // Import specific prompt builders based on document type
        const basePrompt = `Generate a detailed outline for a ${type} document with the following requirements:\n\n`;
        const inputJson = JSON.stringify(input, null, 2);

        return basePrompt + inputJson + '\n\nProvide the outline in JSON format with section IDs as keys.';
    }

    private buildSectionPrompt(
        type: DocumentType,
        sectionId: string,
        sectionOutline: any,
        originalInput: any
    ): string {
        return `Write the "${sectionId}" section based on this outline:\n${JSON.stringify(sectionOutline)}\n\nOriginal requirements:\n${JSON.stringify(originalInput)}\n\nWrite in a professional, engaging style.`;
    }

    private buildRefinementPrompt(
        type: DocumentType,
        content: string,
        requirements: any
    ): string {
        return `Review and refine this ${type} document to ensure it meets all requirements:\n\n${content}\n\nRequirements:\n${JSON.stringify(requirements)}\n\nImprove flow, consistency, and professionalism while maintaining all content.`;
    }

    private parseOutlineFromText(text: string): any {
        // Fallback parser if JSON parsing fails
        const sections: Record<string, any> = {};
        const lines = text.split('\n');
        let currentSection = '';

        for (const line of lines) {
            if (line.match(/^\d+\.|^[A-Z]\.|^-/)) {
                const sectionName = line.replace(/^[\d\w]+\.|-/, '').trim();
                currentSection = sectionName.toLowerCase().replace(/\s+/g, '_');
                sections[currentSection] = { title: sectionName, points: [] };
            } else if (currentSection && line.trim()) {
                sections[currentSection].points.push(line.trim());
            }
        }

        return sections;
    }

    private emitProgress(
        progress: GenerationProgress,
        callback?: (progress: GenerationProgress) => void
    ) {
        if (callback) {
            callback(progress);
        }
        this.progressEmitter.emit('progress', progress);
    }

    onProgress(callback: (progress: GenerationProgress) => void) {
        this.progressEmitter.on('progress', callback);
    }
}