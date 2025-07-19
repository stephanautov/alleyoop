// src/server/services/llm/index.ts
<<<<<<< HEAD
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
=======
import type { LLMProvider, GenerationProgress } from "./base";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { PerplexityProvider } from "./providers/perplexity";
import { LlamaProvider, type LlamaProviderType } from "./providers/llama";
import { DocumentType } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EventEmitter } from "events";
import { env } from "~/env";
import { db } from "~/server/db";

export type ProviderName =
  | "openai"
  | "anthropic"
  | "gemini"
  | "perplexity"
  | "llama";

export interface LLMServiceConfig {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  llamaProvider?: LlamaProviderType; // For Llama sub-providers
  baseUrl?: string; // For custom endpoints
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  contextWindow: number;
  maxOutput: number;
  costPer1kTokens: { input: number; output: number };
  capabilities: string[];
  recommended: boolean;
}

export class LLMService {
  private provider: LLMProvider;
  private providerName: ProviderName;
  private model: string;
  private progressEmitter = new EventEmitter();

  // Available models registry
  static readonly MODELS: ModelInfo[] = [
    // OpenAI
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      provider: "openai",
      contextWindow: 128000,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      capabilities: ["chat", "code", "vision", "function-calling"],
      recommended: true,
    },
    {
      id: "gpt-4",
      name: "GPT-4",
      provider: "openai",
      contextWindow: 8192,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.03, output: 0.06 },
      capabilities: ["chat", "code", "function-calling"],
      recommended: false,
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      provider: "openai",
      contextWindow: 16385,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.001, output: 0.002 },
      capabilities: ["chat", "code", "function-calling"],
      recommended: true,
    },

    // Anthropic
    {
      id: "claude-3-opus",
      name: "Claude 3 Opus",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      capabilities: ["chat", "code", "vision", "long-context"],
      recommended: true,
    },
    {
      id: "claude-3-sonnet",
      name: "Claude 3 Sonnet",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      capabilities: ["chat", "code", "vision", "long-context"],
      recommended: true,
    },
    {
      id: "claude-3-haiku",
      name: "Claude 3 Haiku",
      provider: "anthropic",
      contextWindow: 200000,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
      capabilities: ["chat", "code", "fast"],
      recommended: false,
    },

    // Gemini
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      provider: "gemini",
      contextWindow: 1000000,
      maxOutput: 8192,
      costPer1kTokens: { input: 0.0035, output: 0.0105 },
      capabilities: ["chat", "code", "vision", "ultra-long-context"],
      recommended: true,
    },
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      provider: "gemini",
      contextWindow: 1000000,
      maxOutput: 8192,
      costPer1kTokens: { input: 0.00035, output: 0.00105 },
      capabilities: ["chat", "code", "vision", "fast", "ultra-long-context"],
      recommended: true,
    },

    // Perplexity
    {
      id: "sonar-large",
      name: "Perplexity Sonar Large",
      provider: "perplexity",
      contextWindow: 32000,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.001, output: 0.001 },
      capabilities: ["chat", "search", "citations", "real-time"],
      recommended: true,
    },

    // Llama
    {
      id: "llama-3-70b",
      name: "Llama 3 70B",
      provider: "llama",
      contextWindow: 8192,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.0009, output: 0.0009 },
      capabilities: ["chat", "code", "open-source"],
      recommended: true,
    },
    {
      id: "codellama-34b",
      name: "Code Llama 34B",
      provider: "llama",
      contextWindow: 16384,
      maxOutput: 4096,
      costPer1kTokens: { input: 0.0005, output: 0.0005 },
      capabilities: ["code", "open-source"],
      recommended: false,
    },
  ];

  constructor(config: LLMServiceConfig = {}) {
    this.providerName =
      config.provider || (env.DEFAULT_LLM_PROVIDER as ProviderName) || "openai";
    this.model = config.model || env.DEFAULT_LLM_MODEL || "gpt-4-turbo";

    switch (this.providerName) {
      case "openai":
        this.provider = new OpenAIProvider(config.apiKey);
        break;

      case "anthropic":
        this.provider = new AnthropicProvider(config.apiKey);
        break;

      case "gemini":
        this.provider = new GeminiProvider(config.apiKey);
        break;

      case "perplexity":
        this.provider = new PerplexityProvider(config.apiKey);
        break;

      case "llama":
        this.provider = new LlamaProvider({
          provider: config.llamaProvider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });
        break;

      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid LLM provider: ${this.providerName}`,
        });
    }
  }

  // Get available models for a provider
  static getModelsForProvider(provider: ProviderName): ModelInfo[] {
    return LLMService.MODELS.filter((m) => m.provider === provider);
  }

  // Get recommended models across all providers
  static getRecommendedModels(): ModelInfo[] {
    return LLMService.MODELS.filter((m) => m.recommended);
  }

  // Get model by capability
  static getModelsByCapability(capability: string): ModelInfo[] {
    return LLMService.MODELS.filter((m) => m.capabilities.includes(capability));
  }

  async generateOutline(params: {
    type: DocumentType;
    input: any;
    userId?: string;
    documentId?: string;
    onProgress?: (progress: GenerationProgress) => void;
  }): Promise<any> {
    this.emitProgress(
      {
        stage: "outline",
        progress: 10,
        message: "Generating document outline...",
      },
      params.onProgress,
    );

    const prompt = this.buildOutlinePrompt(params.type, params.input);
    const systemPrompt = this.getSystemPrompt(params.type);

    const startTime = Date.now();
    const response = await this.provider.generateCompletion({
      prompt,
      model: this.model,
      temperature: 0.7,
      systemPrompt,
      maxTokens: 2000,
    });
    const duration = Date.now() - startTime;

    // Track LLM call if documentId provided
    if (params.documentId && params.userId) {
      await this.trackLLMCall({
        documentId: params.documentId,
        provider: this.providerName,
        model: this.model,
        prompt: prompt.substring(0, 1000), // Store first 1000 chars
        response: response.content.substring(0, 1000),
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        cost: this.provider.estimateCost(response.totalTokens, this.model),
        duration,
      });
    }

    this.emitProgress(
      {
        stage: "outline",
        progress: 30,
        message: "Outline generated successfully",
      },
      params.onProgress,
    );

    try {
      return JSON.parse(response.content);
    } catch {
      return this.parseOutlineFromText(response.content);
    }
  }

  async generateSections(params: {
    outline: any;
    type: DocumentType;
    input: any;
    userId?: string;
    documentId?: string;
    onProgress?: (progress: GenerationProgress) => void;
  }): Promise<Record<string, string>> {
    const sections: Record<string, string> = {};
    const totalSections = Object.keys(params.outline).length;
    let completedSections = 0;

    for (const [sectionId, sectionOutline] of Object.entries(params.outline)) {
      this.emitProgress(
        {
          stage: "sections",
          progress: 30 + (completedSections / totalSections) * 50,
          message: `Generating section: ${sectionId}`,
          currentSection: sectionId,
        },
        params.onProgress,
      );

      const prompt = this.buildSectionPrompt(
        params.type,
        sectionId,
        sectionOutline,
        params.input,
      );

      const startTime = Date.now();
      const response = await this.provider.generateCompletion({
        prompt,
        model: this.model,
        temperature: 0.7,
        maxTokens: 3000,
      });
      const duration = Date.now() - startTime;

      // Track each section generation
      if (params.documentId && params.userId) {
        await this.trackLLMCall({
          documentId: params.documentId,
          provider: this.providerName,
          model: this.model,
          prompt: `Section: ${sectionId}`,
          response: response.content.substring(0, 500),
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          cost: this.provider.estimateCost(response.totalTokens, this.model),
          duration,
        });
      }

      sections[sectionId] = response.content;
      completedSections++;
    }

    return sections;
  }

  async refineDocument(params: {
    sections: Record<string, string>;
    type: DocumentType;
    requirements: any;
    userId?: string;
    documentId?: string;
  }): Promise<{ content: string; metadata: any }> {
    this.emitProgress({
      stage: "refinement",
      progress: 85,
      message: "Refining and finalizing document...",
    });

    const combinedContent = Object.entries(params.sections)
      .map(([id, content]) => content)
      .join("\n\n");

    // Optional refinement for better flow
    if (this.shouldRefine(params.type)) {
      const refinementPrompt = this.buildRefinementPrompt(
        params.type,
        combinedContent,
        params.requirements,
      );

      const response = await this.provider.generateCompletion({
        prompt: refinementPrompt,
        model: this.model,
        temperature: 0.3,
        maxTokens: 5000,
      });

      if (params.documentId && params.userId) {
        await this.trackLLMCall({
          documentId: params.documentId,
          provider: this.providerName,
          model: this.model,
          prompt: "Document refinement",
          response: "Refined document",
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          cost: this.provider.estimateCost(response.totalTokens, this.model),
          duration: 0,
        });
      }

      this.emitProgress({
        stage: "complete",
        progress: 100,
        message: "Document generation complete!",
      });

      return {
        content: response.content,
        metadata: {
          wordCount: response.content.split(/\s+/).length,
          sections: Object.keys(params.sections),
          generatedAt: new Date(),
          provider: this.providerName,
          model: this.model,
        },
      };
    }

    this.emitProgress({
      stage: "complete",
      progress: 100,
      message: "Document generation complete!",
    });

    return {
      content: combinedContent,
      metadata: {
        wordCount: combinedContent.split(/\s+/).length,
        sections: Object.keys(params.sections),
        generatedAt: new Date(),
        provider: this.providerName,
        model: this.model,
      },
    };
  }

  async generate(params: {
    type: DocumentType;
    input: any;
    userId?: string;
    documentId?: string;
    onProgress?: (progress: GenerationProgress) => void;
  }): Promise<{
    documentId?: string;
    content: string;
    outline: any;
    sections: Record<string, string>;
    tokenUsage?: { prompt: number; completion: number; total: number };
    cost?: number;
  }> {
    const { type, input, userId, documentId, onProgress } = params;

    // 1. Generate outline
    const outline = await this.generateOutline({
      type,
      input,
      userId,
      documentId,
      onProgress,
    });

    // 2. Generate sections based on outline
    const sections = await this.generateSections({
      outline,
      type,
      input,
      userId,
      documentId,
      onProgress,
    });

    // 3. Refine the document for better flow
    const { content } = await this.refineDocument({
      sections,
      type,
      requirements: input?.requirements || {},
      userId,
      documentId,
    });

    // NOTE: Detailed token usage / cost tracking is handled by provider-specific calls inside the previous methods.
    return {
      documentId,
      content,
      outline,
      sections,
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
    const inputText = JSON.stringify(input);
    const baseTokens = this.provider.countTokens(inputText);

    const breakdown = {
      outline: baseTokens * 2,
      sections: baseTokens * 10,
      refinement: baseTokens * 3,
    };

    const totalTokens = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const estimatedCost = this.provider.estimateCost(totalTokens, this.model);

    return {
      estimatedTokens: totalTokens,
      estimatedCost,
      breakdown,
    };
  }

  // Provider-specific features
  async generateWithSearch(query: string, options?: any) {
    if (this.providerName === "perplexity") {
      const provider = this.provider as PerplexityProvider;
      return provider.generateWithSearch({
        prompt: query,
        ...options,
      });
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Search is only available with Perplexity provider",
    });
  }

  async generateWithVision(prompt: string, images: any[], options?: any) {
    if (this.providerName === "anthropic") {
      const provider = this.provider as AnthropicProvider;
      return provider.generateWithVision({
        prompt,
        images,
        ...options,
      });
    }

    if (this.providerName === "gemini") {
      const provider = this.provider as GeminiProvider;
      return provider.generateWithVision({
        prompt,
        images,
        ...options,
      });
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Vision is only available with Anthropic and Gemini providers",
    });
  }

  private async trackLLMCall(data: {
    documentId: string;
    provider: string;
    model: string;
    prompt: string;
    response: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    duration: number;
  }) {
    try {
      await db.lLMCall.create({
        data,
      });
    } catch (error) {
      console.error("Failed to track LLM call:", error);
    }
  }

  private getSystemPrompt(type: DocumentType): string {
    const prompts: Record<DocumentType, string> = {
      [DocumentType.BIOGRAPHY]:
        "You are an expert biographer who creates compelling, accurate, and well-researched biographical content.",
      [DocumentType.CASE_SUMMARY]:
        "You are a legal expert specializing in creating clear, accurate case summaries with proper legal citations.",
      [DocumentType.BUSINESS_PLAN]:
        "You are a business consultant expert at creating comprehensive, investor-ready business plans.",
      [DocumentType.MEDICAL_REPORT]:
        "You are a medical documentation specialist who creates clear, accurate medical reports.",
      [DocumentType.GRANT_PROPOSAL]:
        "You are a grant writing expert who creates compelling, well-structured grant proposals.",
    };

    return prompts[type] || "You are an expert document writer.";
  }

  private shouldRefine(type: DocumentType): boolean {
    // Some document types benefit more from refinement
    return [
      DocumentType.BUSINESS_PLAN,
      DocumentType.GRANT_PROPOSAL,
      DocumentType.CASE_SUMMARY,
      DocumentType.MEDICAL_REPORT,
      DocumentType.BIOGRAPHY,
    ].includes(type);
  }

  private buildOutlinePrompt(type: DocumentType, input: any): string {
    // Import specific prompt builders based on document type
    const basePrompt = `Generate a detailed outline for a ${type} document with the following requirements:\n\n`;
    const inputJson = JSON.stringify(input, null, 2);

    return (
      basePrompt +
      inputJson +
      "\n\nProvide the outline in JSON format with section IDs as keys and detailed descriptions as values."
    );
  }

  private buildSectionPrompt(
    type: DocumentType,
    sectionId: string,
    sectionOutline: any,
    originalInput: any,
  ): string {
    return `Write the "${sectionId}" section based on this outline:\n${JSON.stringify(sectionOutline, null, 2)}\n\nOriginal requirements:\n${JSON.stringify(originalInput, null, 2)}\n\nWrite in a professional, engaging style appropriate for a ${type} document.`;
  }

  private buildRefinementPrompt(
    type: DocumentType,
    content: string,
    requirements: any,
  ): string {
    return `Review and refine this ${type} document to ensure it meets all requirements. Improve flow, consistency, and professionalism while maintaining all content.\n\nDocument:\n${content}\n\nRequirements:\n${JSON.stringify(requirements, null, 2)}`;
  }

  private parseOutlineFromText(text: string): any {
    const sections: Record<string, any> = {};
    const lines = text.split("\n");
    let currentSection = "";

    for (const line of lines) {
      if (line.match(/^\d+\.|^[A-Z]\.|^-/)) {
        const sectionName = line.replace(/^[\d\w]+\.|-/, "").trim();
        currentSection = sectionName.toLowerCase().replace(/\s+/g, "_");
        sections[currentSection] = { title: sectionName, points: [] };
      } else if (currentSection && line.trim()) {
        sections[currentSection].points.push(line.trim());
      }
    }

    return sections;
  }

  private emitProgress(
    progress: GenerationProgress,
    callback?: (progress: GenerationProgress) => void,
  ) {
    if (callback) {
      callback(progress);
    }
    this.progressEmitter.emit("progress", progress);
  }

  onProgress(callback: (progress: GenerationProgress) => void) {
    this.progressEmitter.on("progress", callback);
  }
}
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
