// src/server/services/llm/base.ts
import { z } from "zod";
import { DocumentType } from "@prisma/client";

export interface LLMProvider {
<<<<<<< HEAD
    name: string;
    generateCompletion(params: CompletionParams): Promise<CompletionResponse>;
    countTokens(text: string): number;
    estimateCost(tokens: number, model: string): number;
}

export interface CompletionParams {
    prompt: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface CompletionResponse {
    content: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
}

export interface GenerationProgress {
    stage: 'outline' | 'sections' | 'refinement' | 'complete';
    progress: number; // 0-100
    message: string;
    currentSection?: string;
}

=======
  name: string;
  generateCompletion(params: CompletionParams): Promise<CompletionResponse>;
  countTokens(text: string): number;
  estimateCost(tokens: number, model: string): number;
}

export interface CompletionParams {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface CompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export interface GenerationProgress {
  stage: "outline" | "sections" | "refinement" | "complete";
  progress: number; // 0-100
  message: string;
  currentSection?: string;
}
>>>>>>> 274f729c831bd20c718b4330ccf805c6875e082e
