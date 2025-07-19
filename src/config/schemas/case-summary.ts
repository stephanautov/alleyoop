// src/config/schemas/case-summary.ts
import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const caseSummarySchema = baseDocumentSchema.extend({
    caseInfo: z.object({
        caseName: z.string().min(1).default(''),
        caseNumber: z.string().optional().default(''),
        court: z.string().min(1).default(''),
        dateDecided: z.string().optional().default(''),
    }).default({
        caseName: '',
        caseNumber: '',
        court: '',
        dateDecided: ''
    }),
    parties: z.object({
        plaintiff: z.string().min(1).default(''),
        defendant: z.string().min(1).default(''),
    }).default({
        plaintiff: '',
        defendant: ''
    }),
    legalIssues: z.array(z.string()).min(1).default([']),
    facts: z.string().optional().default(''),
        includeAnalysis: z.boolean().default(true),
        citationStyle: z.enum(["bluebook", "apa", "mla"]).default("bluebook"),
});

export const caseSummaryFieldConfig = {
    "caseInfo.caseName": {
        label: "Case Name",
        placeholder: "e.g., Smith v. Jones",
    },
    "caseInfo.caseNumber": {
        label: "Case Number (Optional)",
        placeholder: "e.g., 2023-CV-1234",
    },
    "caseInfo.court": {
        label: "Court",
        placeholder: "e.g., Supreme Court of California",
    },
    "caseInfo.dateDecided": {
        label: "Date Decided (Optional)",
        type: "date",
    },
    "parties.plaintiff": {
        label: "Plaintiff(s)",
        placeholder: "Party bringing the lawsuit",
    },
    "parties.defendant": {
        label: "Defendant(s)",
        placeholder: "Party being sued",
    },
    legalIssues: {
        label: "Legal Issues",
        description: "Add key legal questions or issues",
        placeholder: "Enter a legal issue and press Add",
    },
    facts: {
        label: "Case Facts (Optional)",
        placeholder: "Brief summary of relevant facts",
        type: "textarea",
        rows: 4,
    },
    includeAnalysis: {
        label: "Include Legal Analysis",
        description: "Add analysis of the court's reasoning",
    },
    citationStyle: {
        label: "Citation Style",
        options: [
            { value: "bluebook", label: "Bluebook" },
            { value: "apa", label: "APA" },
            { value: "mla", label: "MLA" },
        ],
    },
};