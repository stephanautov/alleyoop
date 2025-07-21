// src/config/schemas/business-plan.ts
import { z } from "zod";
import { baseDocumentSchema } from "./base";

export const businessPlanSchema = baseDocumentSchema.extend({
  business: z
    .object({
      name: z.string().min(1).default(""),
      industry: z.string().min(1).default(""),
      stage: z
        .enum(["idea", "startup", "growth", "established"])
        .default("startup"),
      location: z.string().min(1).default(""),
    })
    .default({
      name: "",
      industry: "",
      stage: "startup",
      location: "",
    }),
  sections: z
    .array(
      z.enum([
        "executive_summary",
        "company_description",
        "market_analysis",
        "organization_management",
        "service_product_line",
        "marketing_sales",
        "funding_request",
        "financial_projections",
        "appendix",
      ]),
    )
    .default(["executive_summary", "company_description", "market_analysis"]),
  targetAudience: z
    .enum(["investors", "lenders", "partners", "internal"])
    .default("investors"),
  fundingAmount: z.string().optional().default(""),
  timeframe: z.string().default("3 years"),
});

export const businessPlanFieldConfig = {
  "business.name": {
    label: "Business Name",
    placeholder: "Your company name",
  },
  "business.industry": {
    label: "Industry",
    placeholder: "e.g., Technology, Healthcare, Retail",
  },
  "business.stage": {
    label: "Business Stage",
    options: [
      { value: "idea", label: "Idea Stage" },
      { value: "startup", label: "Startup" },
      { value: "growth", label: "Growth Stage" },
      { value: "established", label: "Established" },
    ],
  },
  "business.location": {
    label: "Location",
    placeholder: "City, State/Country",
  },
  sections: {
    label: "Sections to Include",
    description: "Select which sections to include in your business plan",
    multiple: true,
    options: [
      { value: "executive_summary", label: "Executive Summary" },
      { value: "company_description", label: "Company Description" },
      { value: "market_analysis", label: "Market Analysis" },
      { value: "organization_management", label: "Organization & Management" },
      { value: "service_product_line", label: "Service or Product Line" },
      { value: "marketing_sales", label: "Marketing & Sales" },
      { value: "funding_request", label: "Funding Request" },
      { value: "financial_projections", label: "Financial Projections" },
      { value: "appendix", label: "Appendix" },
    ],
  },
  targetAudience: {
    label: "Target Audience",
    options: [
      { value: "investors", label: "Investors" },
      { value: "lenders", label: "Banks/Lenders" },
      { value: "partners", label: "Business Partners" },
      { value: "internal", label: "Internal Use" },
    ],
  },
  fundingAmount: {
    label: "Funding Amount (Optional)",
    placeholder: "e.g., $500,000",
  },
  timeframe: {
    label: "Planning Timeframe",
    placeholder: "e.g., 3 years, 5 years",
  },
  title: {
    label: "Document Title",
    placeholder: "My Business Plan",
  },
};
