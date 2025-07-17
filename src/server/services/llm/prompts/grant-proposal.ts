// src/server/services/llm/prompts/grant-proposal.ts
// ============================================

import { z } from 'zod';
import { grantProposalSchema } from '~/config/schemas/grant-proposal';

type GrantProposalInput = z.infer<typeof grantProposalSchema>;

export const grantProposalPrompts = {
    // System prompts optimized per provider
    systemPrompts: {
        openai: `You are an expert grant writer with a proven track record of securing funding. You excel at crafting compelling narratives that align project goals with funder priorities while demonstrating clear impact and sustainability.`,

        anthropic: `You are a thoughtful grant strategist who creates persuasive proposals that tell powerful stories. You understand how to connect human needs with institutional priorities, creating proposals that resonate on both emotional and analytical levels.`,

        gemini: `You are a comprehensive grant writer who excels at creating detailed, well-researched proposals. You balance compelling narratives with solid data, ensuring every proposal meets funder requirements while standing out from the competition.`,

        perplexity: `You are a research-focused grant writer who creates evidence-based proposals backed by solid data. You excel at finding relevant statistics, citations, and supporting research to strengthen every claim.`,

        llama: `You are a practical grant writer who creates clear, achievable proposals. You focus on realistic outcomes and measurable impact, ensuring every proposal is both fundable and executable.`
    },

    // Outline generation prompt
    outline: (input: GrantProposalInput, provider: string) => {
        const grantType = input.grantType;
        const funderType = input.funderType;

        let providerSpecific = '';

        if (provider === 'perplexity') {
            providerSpecific = `\n\nIMPORTANT: Include relevant research citations and statistics to support the need.`;
        } else if (provider === 'anthropic') {
            providerSpecific = `\n\nFocus on the human impact and transformation your project will create.`;
        }

        return `Create a detailed outline for a grant proposal.

Grant Details:
- Organization: ${input.organizationName}
- Project Title: ${input.projectTitle}
- Grant Type: ${grantType}
- Funder Type: ${funderType}
- Amount Requested: $${input.amountRequested}
- Project Duration: ${input.projectDuration}

Funder Information:
- Funder Name: ${input.funderName}
- Funder Priorities: ${input.funderPriorities || 'Not specified'}

Project Summary:
${input.projectSummary}

Target Population: ${input.targetPopulation}
Geographic Area: ${input.geographicScope}
${providerSpecific}

Generate a JSON outline with the following structure:
{
  "title": "Proposal title",
  "sections": {
    "executive_summary": {
      "title": "Executive Summary",
      "content_points": ["Problem statement", "Proposed solution", "Expected outcomes", "Budget summary"],
      "max_length": "1 page"
    },
    "statement_of_need": {
      "title": "Statement of Need",
      "subsections": ["Problem Definition", "Supporting Data", "Target Population", "Geographic Scope"],
      "emphasis": "Compelling evidence of need"
    },
    "project_description": {
      "title": "Project Description",
      "subsections": ["Goals and Objectives", "Methodology", "Timeline", "Deliverables"],
      "focus": "Clear, achievable outcomes"
    },
    "evaluation": {
      "title": "Evaluation Plan",
      "content_points": ["Success metrics", "Data collection", "Reporting schedule", "Long-term tracking"],
      "emphasis": "Measurable impact"
    },
    "organization_capacity": {
      "title": "Organizational Capacity",
      "content_points": ["Track record", "Staff qualifications", "Infrastructure", "Partnerships"],
      "focus": "Ability to execute"
    },
    "budget": {
      "title": "Budget Narrative",
      "subsections": ["Personnel", "Direct costs", "Indirect costs", "Cost justification"],
      "emphasis": "Value for money"
    },
    "sustainability": {
      "title": "Sustainability Plan",
      "content_points": ["Future funding", "Community ownership", "Scaling potential", "Long-term impact"]
    }
  }
}`;
    }
}