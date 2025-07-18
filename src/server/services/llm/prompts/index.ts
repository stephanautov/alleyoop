// src/server/services/llm/prompts/index.ts
// ============================================

import { DocumentType } from '@prisma/client';
import { z } from 'zod';
import { biographyPrompts } from './biography';
import { caseSummaryPrompts } from './case-summary';
import { businessPlanPrompts } from './business-plan';
import { grantProposalPrompts } from './grant-proposal';
import { medicalReportPrompts } from './medical-report';

// Import schema types
import type {
  biographySchema,
  caseSummarySchema,
  businessPlanSchema,
  grantProposalSchema,
  medicalReportSchema
} from '~/config/schemas';

// Define provider types
export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'llama';

// Define provider settings type
type ProviderSettings = {
  model: string;
  temperature: number;
  maxTokens: number;
};

type DocumentSettings = Record<ProviderName, ProviderSettings>;

// Define prompt structure types
type DocumentPrompts = {
  systemPrompts: Record<string, string>;
  outline: (input: any, provider: string) => string;
  section: (
    sectionId: string,
    sectionOutline: any,
    fullOutline: any,
    originalInput: any,
    previousSections?: Record<string, string>
  ) => string;
  refinement: (content: string, input: any) => string;
  generateWithProvider?: Record<string, (input: any) => string>;
};

// Export document prompts with proper typing
export const DOCUMENT_PROMPTS: Record<DocumentType, DocumentPrompts> = {
  [DocumentType.BIOGRAPHY]: biographyPrompts,
  [DocumentType.CASE_SUMMARY]: caseSummaryPrompts,
  [DocumentType.BUSINESS_PLAN]: businessPlanPrompts,
  [DocumentType.GRANT_PROPOSAL]: grantProposalPrompts,
  [DocumentType.MEDICAL_REPORT]: medicalReportPrompts,
};

// Export document settings with proper typing
export const DOCUMENT_SETTINGS: Record<DocumentType, DocumentSettings> = {
  [DocumentType.BIOGRAPHY]: {
    openai: { model: 'gpt-4-turbo', temperature: 0.8, maxTokens: 4000 },
    anthropic: { model: 'claude-3-opus', temperature: 0.8, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.8, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.7, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.8, maxTokens: 4000 },
  },
  [DocumentType.CASE_SUMMARY]: {
    openai: { model: 'gpt-4-turbo', temperature: 0.3, maxTokens: 4000 },
    anthropic: { model: 'claude-3-sonnet', temperature: 0.4, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.3, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.2, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.3, maxTokens: 4000 },
  },
  [DocumentType.BUSINESS_PLAN]: {
    openai: { model: 'gpt-4-turbo', temperature: 0.6, maxTokens: 4000 },
    anthropic: { model: 'claude-3-sonnet', temperature: 0.6, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.6, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.5, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.6, maxTokens: 4000 },
  },
  [DocumentType.GRANT_PROPOSAL]: {
    openai: { model: 'gpt-4-turbo', temperature: 0.7, maxTokens: 4000 },
    anthropic: { model: 'claude-3-sonnet', temperature: 0.8, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.7, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.6, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.7, maxTokens: 4000 },
  },
  [DocumentType.MEDICAL_REPORT]: {
    openai: { model: 'gpt-4-turbo', temperature: 0.2, maxTokens: 4000 },
    anthropic: { model: 'claude-3-sonnet', temperature: 0.3, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.2, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.1, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.2, maxTokens: 4000 },
  },
};

// Type-safe prompt getter functions
export function getDocumentPrompts(documentType: DocumentType): DocumentPrompts {
  const prompts = DOCUMENT_PROMPTS[documentType];
  if (!prompts) {
    throw new Error(`No prompts configured for document type: ${documentType}`);
  }
  return prompts;
}

export function getSystemPrompt(
  documentType: DocumentType,
  provider: ProviderName
): string {
  const prompts = getDocumentPrompts(documentType);
  const systemPrompt = prompts.systemPrompts[provider] || prompts.systemPrompts.openai;

  if (!systemPrompt) {
    // Fallback to first available prompt or throw error
    const availablePrompt = Object.values(prompts.systemPrompts)[0];
    if (!availablePrompt) {
      throw new Error(`No system prompts available for document type: ${documentType}`);
    }
    return availablePrompt;
  }

  return systemPrompt;
}

export function getOutlinePrompt(
  documentType: DocumentType,
  provider: ProviderName,
  input: any
): string {
  const prompts = getDocumentPrompts(documentType);
  return prompts.outline(input, provider);
}

export function getSectionPrompt(
  documentType: DocumentType,
  sectionId: string,
  sectionOutline: any,
  fullOutline: any,
  originalInput: any,
  previousSections?: Record<string, string>
): string {
  const prompts = getDocumentPrompts(documentType);
  return prompts.section(
    sectionId,
    sectionOutline,
    fullOutline,
    originalInput,
    previousSections
  );
}

export function getRefinementPrompt(
  documentType: DocumentType,
  content: string,
  input: any
): string {
  const prompts = getDocumentPrompts(documentType);
  return prompts.refinement(content, input);
}

// Type-safe settings getter
export function getDocumentSettings(
  documentType: DocumentType,
  provider: ProviderName
): ProviderSettings {
  const settings = DOCUMENT_SETTINGS[documentType];
  if (!settings) {
    // Return defaults if not found
    return {
      model: provider === 'openai' ? 'gpt-4-turbo' : 'default',
      temperature: 0.7,
      maxTokens: 4000,
    };
  }

  const providerSettings = settings[provider];
  if (!providerSettings) {
    // Return defaults for unknown provider
    return {
      model: 'default',
      temperature: 0.7,
      maxTokens: 4000,
    };
  }

  return providerSettings;
}

// Export types
export type { DocumentPrompts, ProviderSettings, DocumentSettings };