// src/config/documents.ts
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { env } from "~/env";

// Import your schemas (adjust paths as needed)
import { baseDocumentSchema } from "./schemas/base";
import { biographySchema } from "./schemas/biography";
import { caseSummarySchema } from "./schemas/case-summary";
import { businessPlanSchema } from "./schemas/business-plan";
import { medicalReportSchema } from "./schemas/medical-report";
import { grantProposalSchema } from "./schemas/grant-proposal";

// Document type configuration map
export const DOCUMENT_CONFIGS = {
  [DocumentType.BIOGRAPHY]: {
    schema: biographySchema,
    name: "Biography",
    description: "Create professional or personal biographies",
    icon: "User",
    enabled: env.NEXT_PUBLIC_ENABLE_BIOGRAPHY,
    sections: [
      { id: "introduction", name: "Introduction", order: 1 },
      { id: "early_life", name: "Early Life", order: 2 },
      { id: "education", name: "Education", order: 3 },
      { id: "career", name: "Career", order: 4 },
      { id: "achievements", name: "Achievements", order: 5 },
      { id: "personal_life", name: "Personal Life", order: 6 },
      { id: "legacy", name: "Legacy & Impact", order: 7 },
      { id: "conclusion", name: "Conclusion", order: 8 },
    ],
    exportFormats: ["pdf", "docx", "markdown"],
    estimatedTokens: {
      short: 2000,
      medium: 4000,
      long: 8000,
    },
  },
  [DocumentType.CASE_SUMMARY]: {
    schema: caseSummarySchema,
    name: "Case Summary",
    description: "Generate legal case summaries and briefs",
    icon: "Scale",
    enabled: env.NEXT_PUBLIC_ENABLE_CASE_SUMMARY,
    sections: [
      { id: "header", name: "Case Header", order: 1 },
      { id: "parties", name: "Parties", order: 2 },
      { id: "facts", name: "Facts of the Case", order: 3 },
      { id: "issues", name: "Legal Issues", order: 4 },
      { id: "holdings", name: "Holdings", order: 5 },
      { id: "reasoning", name: "Court's Reasoning", order: 6 },
      { id: "impact", name: "Impact & Significance", order: 7 },
    ],
    exportFormats: ["pdf", "docx"],
    estimatedTokens: {
      short: 1500,
      medium: 3000,
      long: 5000,
    },
  },
  [DocumentType.BUSINESS_PLAN]: {
    schema: businessPlanSchema,
    name: "Business Plan",
    description: "Create comprehensive business plans",
    icon: "Briefcase",
    enabled: env.NEXT_PUBLIC_ENABLE_BUSINESS_PLAN,
    sections: [
      { id: "executive_summary", name: "Executive Summary", order: 1 },
      { id: "company_description", name: "Company Description", order: 2 },
      { id: "market_analysis", name: "Market Analysis", order: 3 },
      { id: "organization", name: "Organization & Management", order: 4 },
      { id: "products_services", name: "Products/Services", order: 5 },
      { id: "marketing_strategy", name: "Marketing Strategy", order: 6 },
      { id: "financial_projections", name: "Financial Projections", order: 7 },
      { id: "funding_request", name: "Funding Request", order: 8 },
    ],
    exportFormats: ["pdf", "docx", "pptx"],
    estimatedTokens: {
      short: 3000,
      medium: 6000,
      long: 12000,
    },
  },
  [DocumentType.MEDICAL_REPORT]: {
    schema: medicalReportSchema,
    name: "Medical Report",
    description: "Generate medical reports and documentation",
    icon: "Heart",
    enabled: env.NEXT_PUBLIC_ENABLE_MEDICAL_REPORT,
    sections: [
      { id: "patient_info", name: "Patient Information", order: 1 },
      { id: "chief_complaint", name: "Chief Complaint", order: 2 },
      { id: "history", name: "Medical History", order: 3 },
      { id: "examination", name: "Physical Examination", order: 4 },
      { id: "findings", name: "Clinical Findings", order: 5 },
      { id: "diagnosis", name: "Diagnosis", order: 6 },
      { id: "treatment", name: "Treatment Plan", order: 7 },
      { id: "recommendations", name: "Recommendations", order: 8 },
    ],
    exportFormats: ["pdf", "docx"],
    estimatedTokens: {
      short: 2000,
      medium: 4000,
      long: 8000,
    },
  },
  [DocumentType.GRANT_PROPOSAL]: {
    schema: grantProposalSchema,
    name: "Grant Proposal",
    description: "Write compelling grant proposals",
    icon: "FileText",
    enabled: env.NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL,
    sections: [
      { id: "executive_summary", name: "Executive Summary", order: 1 },
      { id: "statement_of_need", name: "Statement of Need", order: 2 },
      { id: "project_description", name: "Project Description", order: 3 },
      { id: "goals_objectives", name: "Goals & Objectives", order: 4 },
      { id: "methodology", name: "Methodology", order: 5 },
      { id: "evaluation", name: "Evaluation Plan", order: 6 },
      { id: "budget", name: "Budget Narrative", order: 7 },
      { id: "organization_info", name: "Organization Information", order: 8 },
      { id: "conclusion", name: "Conclusion", order: 9 },
    ],
    exportFormats: ["pdf", "docx"],
    estimatedTokens: {
      short: 3000,
      medium: 6000,
      long: 12000,
    },
  },
} as const;

// Type exports
export type DocumentConfig = typeof DOCUMENT_CONFIGS[keyof typeof DOCUMENT_CONFIGS];
export type DocumentSchema =
  | z.infer<typeof biographySchema>
  | z.infer<typeof caseSummarySchema>
  | z.infer<typeof businessPlanSchema>
  | z.infer<typeof medicalReportSchema>
  | z.infer<typeof grantProposalSchema>;

// Helper functions
export function getEnabledDocumentTypes(): DocumentType[] {
  return Object.entries(DOCUMENT_CONFIGS)
    .filter(([_, config]) => config.enabled)
    .map(([type]) => type as DocumentType);
}

export function getDocumentConfig(type: DocumentType): DocumentConfig | undefined {
  return DOCUMENT_CONFIGS[type];
}

export function getDocumentSchema(type: DocumentType) {
  const config = DOCUMENT_CONFIGS[type];
  if (!config) {
    throw new Error(`No schema found for document type: ${type}`);
  }
  return config.schema;
}

export function estimateTokenUsage(
  type: DocumentType,
  length: "short" | "medium" | "long"
): number {
  const config = DOCUMENT_CONFIGS[type];
  if (!config) {
    throw new Error(`No configuration found for document type: ${type}`);
  }
  return config.estimatedTokens[length];
}

export function estimateCost(tokens: number): number {
  // GPT-4 pricing (adjust as needed)
  const costPer1kTokens = 0.03;
  return (tokens / 1000) * costPer1kTokens;
}

// Re-export individual schemas for backward compatibility
export {
  biographySchema,
  caseSummarySchema,
  businessPlanSchema,
  medicalReportSchema,
  grantProposalSchema,
};