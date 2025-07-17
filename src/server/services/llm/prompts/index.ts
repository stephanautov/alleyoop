// src/server/services/llm/prompts/index.ts

import { DocumentType } from '@prisma/client';
import { biographyPrompts, getBiographyPrompt, biographySettings } from './biography';
import { caseSummaryPrompts, getCaseSummaryPrompt, caseSummarySettings } from './case-summary';
import { businessPlanPrompts } from './business-plan';
import { grantProposalPrompts } from './grant-proposal';
import { medicalReportPrompts } from './medical-report';

// Export all prompts
export const documentPrompts = {
  [DocumentType.BIOGRAPHY]: biographyPrompts,
  [DocumentType.CASE_SUMMARY]: caseSummaryPrompts,
  [DocumentType.BUSINESS_PLAN]: businessPlanPrompts,
  [DocumentType.GRANT_PROPOSAL]: grantProposalPrompts,
  [DocumentType.MEDICAL_REPORT]: medicalReportPrompts,
};

// Export all settings
export const documentSettings = {
  [DocumentType.BIOGRAPHY]: biographySettings,
  [DocumentType.CASE_SUMMARY]: caseSummarySettings,
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
    openai: { model: 'gpt-4-turbo', temperature: 0.2, maxTokens: 4000 }, // Very low temp for accuracy
    anthropic: { model: 'claude-3-sonnet', temperature: 0.3, maxTokens: 4000 },
    gemini: { model: 'gemini-1.5-pro', temperature: 0.2, maxTokens: 8000 },
    perplexity: { model: 'sonar-large', temperature: 0.1, maxTokens: 4000 },
    llama: { model: 'llama-3-70b', temperature: 0.2, maxTokens: 4000 },
  },
};

// Helper to get prompts for any document type
export function getDocumentPrompt(
  documentType: DocumentType,
  promptType: 'outline' | 'section' | 'refinement',
  provider: string,
  ...args: any[]
) {
  const prompts = documentPrompts[documentType];
  if (!prompts) {
    throw new Error(`No prompts configured for document type: ${documentType}`);
  }

  switch (promptType) {
    case 'outline':
      return prompts.outline(args[0], provider);
    case 'section':
      return prompts.section(...args);
    case 'refinement':
      return prompts.refinement(...args);
    default:
      throw new Error(`Unknown prompt type: ${promptType}`);
  }
}

// Get provider settings for a document type
export function getDocumentSettings(documentType: DocumentType, provider: string) {
  const settings = documentSettings[documentType];
  if (!settings || !settings[provider]) {
    // Return defaults if not found
    return {
      model: provider === 'openai' ? 'gpt-4-turbo' : 'default',
      temperature: 0.7,
      maxTokens: 4000,
    };
  }
  return settings[provider];
}