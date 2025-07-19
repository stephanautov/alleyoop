// src/server/services/llm/prompts/business-plan.ts
// ============================================

import { z } from 'zod';
import { businessPlanSchema } from '~/config/schemas/business-plan';

type BusinessPlanInput = z.infer<typeof businessPlanSchema>;

export const businessPlanPrompts = {
  // System prompts optimized per provider
  systemPrompts: {
    openai: `You are an expert business strategist and entrepreneur with decades of experience creating successful business plans. You excel at market analysis, financial projections, and compelling business narratives that attract investors.`,

    anthropic: `You are a thoughtful business advisor who creates comprehensive, realistic business plans. You balance optimism with pragmatism, identifying both opportunities and challenges while crafting strategies for sustainable growth.`,

    gemini: `You are a versatile business consultant who excels at creating detailed, data-driven business plans. You combine thorough market research with creative strategies and solid financial planning.`,

    perplexity: `You are a research-focused business analyst who creates well-sourced, market-validated business plans. You excel at finding industry data, competitor analysis, and market trends to support strategic decisions.`,

    llama: `You are a practical business planner who creates clear, actionable business plans. You focus on feasibility and execution, ensuring every strategy is implementable and measurable.`
  },

  // Outline generation prompt
  outline: (input: BusinessPlanInput, provider: string) => {
    const businessType = input.businessType;
    const planPurpose = input.planPurpose;
    const stage = input.businessStage;

    let providerSpecific = '';

    if (provider === 'perplexity') {
      providerSpecific = `\n\nIMPORTANT: Include market research sources and competitor data for validation.`;
    } else if (provider === 'openai' && planPurpose === 'investor_pitch') {
      providerSpecific = `\n\nFocus on ROI potential, scalability, and exit strategies that appeal to investors.`;
    }

    return `Create a detailed outline for a business plan.

Business Details:
- Business Name: ${input.business.name}
- Type: ${businessType}
- Industry: ${input.industry}
- Stage: ${stage}
- Target Market: ${input.targetMarket}
- Unique Value Proposition: ${input.uniqueValueProp}

Plan Requirements:
- Purpose: ${planPurpose}
- Funding Needed: ${input.fundingNeeded ? `$${input.fundingAmount || 'TBD'}` : 'No immediate funding needed'}
- Time Horizon: ${input.planHorizon} plan
- Include Financial Projections: ${input.includeFinancials ? 'Yes' : 'No'}
${providerSpecific}

Generate a JSON outline with the following structure:
{
  "title": "Business plan title",
  "executiveSummary": {
    "title": "Executive Summary",
    "subsections": {
      "overview": "Business overview",
      "mission": "Mission and vision",
      "keys_to_success": "Key success factors",
      "financial_highlights": "Financial summary"
    }
  },
  "sections": {
    "company_description": {
      "title": "Company Description",
      "content_points": ["Business concept", "Legal structure", "History", "Current status"],
      "emphasis": "${stage === 'startup' ? 'Vision and potential' : 'Track record and growth'}"
    },
    "market_analysis": {
      "title": "Market Analysis",
      "subsections": ["Industry Overview", "Target Market", "Market Size", "Competitive Analysis"],
      "data_requirements": ["Market size data", "Growth projections", "Customer demographics"]
    },
    "organization_management": {
      "title": "Organization & Management",
      "content_points": ["Organizational structure", "Management team", "Board of directors", "Personnel plan"]
    },
    "products_services": {
      "title": "Products and Services",
      "content_points": ["Product/service description", "Competitive advantages", "Pricing strategy", "Product lifecycle"]
    },
    "marketing_sales": {
      "title": "Marketing & Sales Strategy",
      "subsections": ["Marketing plan", "Sales strategy", "Customer acquisition", "Retention strategy"]
    },
    "funding_request": {
      "title": "Funding Request",
      "content_points": ["Funding requirements", "Use of funds", "Future funding", "Exit strategy"],
      "include": ${input.fundingNeeded}
    },
    "financial_projections": {
      "title": "Financial Projections",
      "subsections": ["Revenue projections", "Expense forecast", "Break-even analysis", "Profit & loss"],
      "time_period": "${input.planHorizon}",
      "include": ${input.includeFinancials}
    }
  }
}`;
  },

  // Section generation prompt
  section: (
    sectionId: string,
    sectionOutline: any,
    fullOutline: any,
    originalInput: BusinessPlanInput,
    previousSections?: Record<string, string>
  ) => {
    const stage = originalInput.businessStage;
    const purpose = originalInput.planPurpose;

    let contextPrompt = '';
    if (previousSections && Object.keys(previousSections).length > 0) {
      contextPrompt = `\n\nPrevious sections covered: ${Object.keys(previousSections).join(', ')}. 
Maintain consistency with established facts and projections.`;
    }

    // Special handling for financial sections
    if (sectionId === 'financial_projections') {
      return `Write the Financial Projections section of the business plan.

Business: ${originalInput.businessName} (${stage} stage)
Industry: ${originalInput.industry}
${contextPrompt}

Create realistic financial projections for a ${originalInput.planHorizon} period including:
1. Revenue projections with clear assumptions
2. Cost structure and operating expenses
3. Cash flow analysis
4. Break-even analysis
5. Key financial metrics and ratios

Use tables where appropriate. Be ${stage === 'startup' ? 'optimistic but realistic' : 'based on historical performance'}.
Clearly state all assumptions.`;
    }

    return `Write the "${sectionOutline.title}" section of the business plan.

Section Details:
${JSON.stringify(sectionOutline, null, 2)}

Business: ${originalInput.businessName} (${originalInput.industry})
Stage: ${stage}
Purpose: ${purpose} business plan
${contextPrompt}

Writing Requirements:
1. Be specific and data-driven where possible
2. ${purpose === 'investor_pitch' ? 'Emphasize growth potential and ROI' : 'Focus on operational excellence'}
3. Use clear subheadings for organization
4. Include relevant metrics and KPIs
5. ${stage === 'startup' ? 'Address potential risks and mitigation strategies' : 'Highlight proven success metrics'}

Write with confidence while maintaining credibility.`;
  },

  // Refinement prompt
  refinement: (content: string, input: BusinessPlanInput) => {
    return `Review and refine this business plan for ${input.business.name}.

Current content:
${content}

Refinement goals:
1. Ensure consistency across all sections
2. Verify all financial projections are realistic and properly explained
3. Strengthen the unique value proposition throughout
4. ${input.planPurpose === 'investor_pitch' ? 'Ensure it addresses investor concerns' : 'Ensure it provides clear operational guidance'}
5. Check for market validation and competitive advantages
6. Improve flow and readability
7. Ensure the executive summary captures all key points

Polish the plan to be professional, compelling, and actionable.`;
  }
};