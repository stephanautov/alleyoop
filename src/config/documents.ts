// src/config/documents.ts (updated to use separate files)
import { DocumentType } from "@prisma/client";
import { env } from "~/env";
import {
    biographySchema,
    biographyFieldConfig,
    caseSummarySchema,
    caseSummaryFieldConfig,
    businessPlanSchema,
    businessPlanFieldConfig,
    grantProposalSchema,
    grantProposalFieldConfig,
} from "./schemas";

export const DOCUMENT_CONFIGS = {
    [DocumentType.BIOGRAPHY]: {
        schema: biographySchema,
        fieldConfig: biographyFieldConfig,
        name: "Biography",
        description: "Create professional or personal biographies",
        icon: "User",
        enabled: env.NEXT_PUBLIC_ENABLE_BIOGRAPHY,
        estimatedTokens: { short: 2000, medium: 4000, long: 8000 },
    },
    [DocumentType.CASE_SUMMARY]: {
        schema: caseSummarySchema,
        fieldConfig: caseSummaryFieldConfig,
        name: "Case Summary",
        description: "Summarize legal cases with proper citations",
        icon: "Scale",
        enabled: env.NEXT_PUBLIC_ENABLE_CASE_SUMMARY,
        estimatedTokens: { short: 1500, medium: 3000, long: 6000 },
    },
    [DocumentType.BUSINESS_PLAN]: {
        schema: businessPlanSchema,
        fieldConfig: businessPlanFieldConfig,
        name: "Business Plan",
        description: "Create comprehensive business plans",
        icon: "Briefcase",
        enabled: env.NEXT_PUBLIC_ENABLE_BUSINESS_PLAN,
        estimatedTokens: { short: 3000, medium: 6000, long: 12000 },
    },
    [DocumentType.GRANT_PROPOSAL]: {
        schema: grantProposalSchema,
        fieldConfig: grantProposalFieldConfig,
        name: "Grant Proposal",
        description: "Write compelling grant proposals",
        icon: "FileText",
        enabled: env.NEXT_PUBLIC_ENABLE_GRANT_PROPOSAL,
        estimatedTokens: { short: 2500, medium: 5000, long: 10000 },
    },
    // Medical Report will be added later
} as const;

export type DocumentConfig = typeof DOCUMENT_CONFIGS[keyof typeof DOCUMENT_CONFIGS];