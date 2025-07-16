//src/config/documents.ts

import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { env } from "~/env";

// Base schema that all documents share
const baseDocumentSchema = z.object({
    title: z.string().min(1).max(200),
    outputLength: z.enum(["short", "medium", "long"]).default("medium"),
    language: z.enum(["en", "es", "fr", "de"]).default("en"),
});

// Individual document schemas
export const biographySchema = baseDocumentSchema.extend({
    subject: z.object({
        name: z.string().min(1),
        occupation: z.string().optional(),
        birthDate: z.string().optional(),
        birthPlace: z.string().optional(),
    }),
    purpose: z.enum(["professional", "academic", "personal", "wikipedia"]),
    tone: z.enum(["formal", "conversational", "inspirational"]),
    focusAreas: z.array(z.enum([
        "early_life",
        "education",
        "career",
        "achievements",
        "personal_life",
        "legacy",
        "publications",
        "awards"
    ])).default(["early_life", "education", "career", "achievements"]),
    additionalInfo: z.string().optional(),
});

export const caseSummarySchema = baseDocumentSchema.extend({
    caseInfo: z.object({
        caseName: z.string().min(1),
        caseNumber: z.string().optional(),
        court: z.string(),
        dateDecided: z.string().optional(),
    }),
    parties: z.object({
        plaintiff: z.string(),
        defendant: z.string(),
    }),
    legalIssues: z.array(z.string()).min(1),
    facts: z.string().optional(),
    includeAnalysis: z.boolean().default(true),
    citationStyle: z.enum(["bluebook", "apa", "mla"]).default("bluebook"),
});

export const businessPlanSchema = baseDocumentSchema.extend({
    business: z.object({
        name: z.string().min(1),
        industry: z.string(),
        stage: z.enum(["idea", "startup", "growth", "established"]),
        location: z.string(),
    }),
    sections: z.array(z.enum([
        "executive_summary",
        "company_description",
        "market_analysis",
        "organization_management",
        "service_product_line",
        "marketing_sales",
        "funding_request",
        "financial_projections",
        "appendix"
    ])).default([
        "executive_summary",
        "company_description",
        "market_analysis",
        "service_product_line",
        "marketing_sales",
        "financial_projections"
    ]),
    targetAudience: z.enum(["investors", "lenders", "partners", "internal"]),
    fundingAmount: z.string().optional(),
    financialYears: z.number().min(1).max(5).default(3),
});

export const medicalReportSchema = baseDocumentSchema.extend({
    patient: z.object({
        identifier: z.string(), // Not using real names for privacy
        age: z.number().optional(),
        sex: z.enum(["male", "female", "other"]).optional(),
    }),
    reportType: z.enum([
        "consultation",
        "discharge_summary",
        "progress_note",
        "operative_report",
        "diagnostic_report"
    ]),
    clinicalInfo: z.object({
        chiefComplaint: z.string(),
        historyOfPresentIllness: z.string(),
        pastMedicalHistory: z.string().optional(),
        medications: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
    }),
    findings: z.string().optional(),
    recommendations: z.string().optional(),
    includeDisclaimer: z.boolean().default(true),
});

export const grantProposalSchema = baseDocumentSchema.extend({
    organization: z.object({
        name: z.string(),
        type: z.enum(["nonprofit", "educational", "research", "government"]),
        taxId: z.string().optional(),
    }),
    grant: z.object({
        funderName: z.string(),
        programName: z.string(),
        amount: z.string(),
        deadline: z.string().optional(),
    }),
    project: z.object({
        title: z.string(),
        duration: z.string(), // e.g., "2 years"
        startDate: z.string().optional(),
    }),
    sections: z.array(z.enum([
        "executive_summary",
        "statement_of_need",
        "project_description",
        "goals_objectives",
        "methodology",
        "evaluation",
        "budget",
        "organization_info",
        "conclusion"
    ])).default([
        "executive_summary",
        "statement_of_need",
        "project_description",
        "goals_objectives",
        "methodology",
        "evaluation",
        "budget"
    ]),
    focusArea: z.string(),
});

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
            { id: "organization_management", name: "Organization & Management", order: 4 },
            { id: "service_product_line", name: "Service or Product Line", order: 5 },
            { id: "marketing_sales", name: "Marketing & Sales", order: 6 },
            { id: "funding_request", name: "Funding Request", order: 7 },
            { id: "financial_projections", name: "Financial Projections", order: 8 },
            { id: "appendix", name: "Appendix", order: 9 },
        ],
        exportFormats: ["pdf", "docx"],
        estimatedTokens: {
            short: 5000,
            medium: 10000,
            long: 20000,
        },
    },
    [DocumentType.MEDICAL_REPORT]: {
        schema: medicalReportSchema,
        name: "Medical Report",
        description: "Generate medical reports and summaries",
        icon: "FileHeart",
        enabled: env.NEXT_PUBLIC_ENABLE_MEDICAL_REPORT,
        sections: [
            { id: "header", name: "Report Header", order: 1 },
            { id: "patient_info", name: "Patient Information", order: 2 },
            { id: "chief_complaint", name: "Chief Complaint", order: 3 },
            { id: "history", name: "History", order: 4 },
            { id: "examination", name: "Examination Findings", order: 5 },
            { id: "assessment", name: "Assessment", order: 6 },
            { id: "plan", name: "Plan", order: 7 },
            { id: "disclaimer", name: "Medical Disclaimer", order: 8 },
        ],
        exportFormats: ["pdf", "docx"],
        estimatedTokens: {
            short: 1000,
            medium: 2000,
            long: 4000,
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

export function getDocumentConfig(type: DocumentType): DocumentConfig {
    return DOCUMENT_CONFIGS[type];
}

export function getDocumentSchema(type: DocumentType) {
    return DOCUMENT_CONFIGS[type].schema;
}

export function estimateTokenUsage(
    type: DocumentType,
    length: "short" | "medium" | "long"
): number {
    return DOCUMENT_CONFIGS[type].estimatedTokens[length];
}

export function estimateCost(tokens: number): number {
    // GPT-4 pricing (adjust as needed)
    const costPer1kTokens = 0.03;
    return (tokens / 1000) * costPer1kTokens;
}