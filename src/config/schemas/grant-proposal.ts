// src/config/schemas/grant-proposal.ts
import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const grantProposalSchema = baseDocumentSchema.extend({
  organization: z
    .object({
      name: z.string().min(1).default(""),
      type: z
        .enum(["nonprofit", "educational", "research", "government"])
        .default("nonprofit"),
      taxId: z.string().optional().default(""),
    })
    .default({
      name: "",
      type: "nonprofit",
      taxId: "",
    }),
  grant: z
    .object({
      funderName: z.string().min(1).default(""),
      programName: z.string().min(1).default(""),
      amount: z.string().min(1).default(""),
      deadline: z.string().optional().default(""),
    })
    .default({
      funderName: "",
      programName: "",
      amount: "",
      deadline: "",
    }),
  project: z
    .object({
      title: z.string().min(1).default(""),
      duration: z.string().min(1).default(""),
      startDate: z.string().optional().default(""),
    })
    .default({
      title: "",
      duration: "",
      startDate: "",
    }),
  sections: z
    .array(
      z.enum([
        "executive_summary",
        "statement_of_need",
        "project_description",
        "goals_objectives",
        "methodology",
        "evaluation",
        "budget",
        "organization_info",
        "conclusion",
      ])
    )
    .default(["executive_summary", "statement_of_need", "project_description"]),
  focusArea: z.string().min(1).default(""),

  // Additional fields for comprehensive grant proposals
  grantType: z
    .enum(["federal", "state", "foundation", "corporate", "community", "other"])
    .default("foundation"),
  funderType: z
    .enum(["government", "foundation", "corporate", "community", "other"])
    .default("foundation"),
  funderPriorities: z.array(z.string()).default([]),
  projectSummary: z.string().optional().default(""),
  targetPopulation: z.string().optional().default(""),
  geographicScope: z.string().optional().default(""),
});

export const grantProposalFieldConfig = {
  "organization.name": {
    label: "Organization Name",
    placeholder: "Enter your organization's name",
  },
  "organization.type": {
    label: "Organization Type",
    options: [
      { value: "nonprofit", label: "Non-Profit" },
      { value: "educational", label: "Educational Institution" },
      { value: "research", label: "Research Organization" },
      { value: "government", label: "Government Agency" },
    ],
  },
  "organization.taxId": {
    label: "Tax ID (Optional)",
    placeholder: "e.g., 12-3456789",
  },
  "grant.funderName": {
    label: "Funder Name",
    placeholder: "Name of the funding organization",
  },
  "grant.programName": {
    label: "Grant Program",
    placeholder: "Specific grant program name",
  },
  "grant.amount": {
    label: "Requested Amount",
    placeholder: "e.g., $50,000",
  },
  "grant.deadline": {
    label: "Submission Deadline (Optional)",
    type: "date",
  },
  "project.title": {
    label: "Project Title",
    placeholder: "Enter your project title",
  },
  "project.duration": {
    label: "Project Duration",
    placeholder: "e.g., 12 months",
  },
  "project.startDate": {
    label: "Proposed Start Date (Optional)",
    type: "date",
  },
  sections: {
    label: "Sections to Include",
    description: "Select which sections to include in your grant proposal",
    multiple: true,
    options: [
      { value: "executive_summary", label: "Executive Summary" },
      { value: "statement_of_need", label: "Statement of Need" },
      { value: "project_description", label: "Project Description" },
      { value: "goals_objectives", label: "Goals & Objectives" },
      { value: "methodology", label: "Methodology" },
      { value: "evaluation", label: "Evaluation Plan" },
      { value: "budget", label: "Budget Justification" },
      { value: "organization_info", label: "Organization Information" },
      { value: "conclusion", label: "Conclusion" },
    ],
  },
  focusArea: {
    label: "Primary Focus Area",
    placeholder: "e.g., Education, Healthcare, Environment",
    description: "The main area your project addresses",
  },

  // Additional field configurations
  grantType: {
    label: "Grant Type",
    options: [
      { value: "federal", label: "Federal Grant" },
      { value: "state", label: "State Grant" },
      { value: "foundation", label: "Foundation Grant" },
      { value: "corporate", label: "Corporate Grant" },
      { value: "community", label: "Community Grant" },
      { value: "other", label: "Other" },
    ],
  },
  funderType: {
    label: "Funder Type",
    options: [
      { value: "government", label: "Government" },
      { value: "foundation", label: "Foundation" },
      { value: "corporate", label: "Corporation" },
      { value: "community", label: "Community Organization" },
      { value: "other", label: "Other" },
    ],
  },
  funderPriorities: {
    label: "Funder Priorities",
    description: "Add key priorities or focus areas of the funder",
    placeholder: "Enter a priority and press Add",
  },
  projectSummary: {
    label: "Project Summary",
    placeholder: "Brief overview of your project (2-3 sentences)",
    type: "textarea",
    rows: 3,
  },
  targetPopulation: {
    label: "Target Population",
    placeholder: "e.g., Low-income families, Youth ages 12-18",
    description: "Who will benefit from this project?",
  },
  geographicScope: {
    label: "Geographic Scope",
    placeholder: "e.g., San Francisco Bay Area, Statewide, National",
    description: "Where will the project be implemented?",
  },
};