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
- Organization: ${input.organization.name} (${input.organization.type})
- Project Title: ${input.project.title}
- Grant Type: ${grantType}
- Funder Type: ${funderType}
- Amount Requested: ${input.grant.amount}
- Project Duration: ${input.project.duration}

Funder Information:
- Funder Name: ${input.grant.funderName}
- Grant Program: ${input.grant.programName}
- Funder Priorities: ${input.funderPriorities.length > 0 ? input.funderPriorities.join(', ') : 'Not specified'}
- Application Deadline: ${input.grant.deadline || 'Not specified'}

Project Summary:
${input.projectSummary || 'Not provided'}

Target Population: ${input.targetPopulation || 'Not specified'}
Geographic Scope: ${input.geographicScope || 'Not specified'}
Focus Area: ${input.focusArea}

Document Requirements:
- Length: ${input.outputLength}
- Language: ${input.language}
- Sections to include: ${input.sections.join(', ')}
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
  },

  // Section generation prompt
  section: (
    sectionId: string,
    sectionOutline: any,
    fullOutline: any,
    originalInput: GrantProposalInput,
    previousSections?: Record<string, string>
  ) => {
    let contextPrompt = '';
    if (previousSections && Object.keys(previousSections).length > 0) {
      contextPrompt = `\n\nPrevious sections have covered: ${Object.keys(previousSections).join(', ')}. 
Build on this foundation without repetition.`;
    }

    // Build relevant context based on section
    let sectionContext = '';
    if (sectionId === 'statement_of_need') {
      sectionContext = `Target Population: ${originalInput.targetPopulation}
Geographic Scope: ${originalInput.geographicScope}
Focus Area: ${originalInput.focusArea}`;
    } else if (sectionId === 'budget') {
      sectionContext = `Total Amount Requested: ${originalInput.grant.amount}
Project Duration: ${originalInput.project.duration}`;
    }

    return `Write the "${sectionOutline.title}" section of the grant proposal.

Section Details:
${JSON.stringify(sectionOutline, null, 2)}

Organization: ${originalInput.organization.name}
Project: ${originalInput.project.title}
${sectionContext}
${contextPrompt}

Writing Requirements:
1. Be specific and data-driven
2. Connect to funder priorities: ${originalInput.funderPriorities.join(', ') || 'General impact'}
3. Show measurable impact
4. Use clear, compelling language
5. Include concrete examples where appropriate

Format appropriately based on the section type and ensure it aligns with the overall proposal narrative.`;
  },

  // Refinement prompt
  refinement: (content: string, input: GrantProposalInput) => {
    return `Review and refine this grant proposal for ${input.organization.name}.

Current content:
${content}

Key proposal elements to verify:
- Grant Type: ${input.grantType}
- Funder Type: ${input.funderType}
- Target Population: ${input.targetPopulation}
- Geographic Scope: ${input.geographicScope}
- Funder Priorities: ${input.funderPriorities.join(', ')}

Refinement goals:
1. Ensure alignment with funder priorities
2. Strengthen the need statement with data
3. Clarify project outcomes and impact metrics
4. Verify budget justification matches ${input.grant.amount}
5. Check for consistency across all sections
6. Enhance the narrative flow
7. Ensure all required sections from [${input.sections.join(', ')}] are properly addressed

Make minimal changes - only improve clarity, impact, and alignment with grant requirements.`;
  },

  // Provider-specific generation methods
  generateWithProvider: {
    perplexity: (input: GrantProposalInput) => {
      return `Research and create a grant proposal for ${input.organization.name}. 
Find relevant statistics, research studies, and evidence to support the need for "${input.project.title}".
Target population: ${input.targetPopulation}
Geographic scope: ${input.geographicScope}
Focus on data-driven arguments and cite all sources.`;
    },

    anthropic: (input: GrantProposalInput) => {
      return `Create a compelling grant proposal for ${input.organization.name} that tells the story of transformation.
Project: "${input.project.title}"
Who we serve: ${input.targetPopulation}
Where we work: ${input.geographicScope}
Focus on human impact, community transformation, and the deeper meaning of this work.
Balance emotional resonance with practical outcomes.`;
    },

    gemini: (input: GrantProposalInput) => {
      return `Develop a comprehensive grant proposal for ${input.organization.name}.
Project: "${input.project.title}"
Grant Type: ${input.grantType}
Amount: ${input.grant.amount}
Duration: ${input.project.duration}
Create a detailed, well-structured proposal that addresses all aspects thoroughly.`;
    }
  }
};