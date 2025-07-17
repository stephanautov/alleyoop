// src/server/services/llm/prompts/case-summary.ts
import { z } from 'zod';
import { caseSummarySchema } from '~/config/schemas/case-summary';

type CaseSummaryInput = z.infer<typeof caseSummarySchema>;

export const caseSummaryPrompts = {
    // System prompts optimized per provider
    systemPrompts: {
        openai: `You are an expert legal analyst with extensive experience in case law and legal writing. You excel at distilling complex legal matters into clear, concise summaries while maintaining accuracy and legal precision.`,

        anthropic: `You are a thoughtful legal scholar who creates nuanced case analyses. You have a gift for identifying the key legal principles and their broader implications while making complex legal concepts accessible.`,

        gemini: `You are a comprehensive legal researcher who excels at thorough case analysis. You balance detailed legal analysis with clear structure, ensuring every case summary is both legally sound and easy to understand.`,

        perplexity: `You are a research-focused legal analyst who creates accurate, well-sourced case summaries. You excel at finding and citing relevant precedents and legal authorities.`,

        llama: `You are a skilled legal writer who creates clear, structured case summaries. You focus on accuracy and accessibility, making legal concepts understandable without sacrificing precision.`
    },

    // Outline generation prompt
    outline: (input: CaseSummaryInput, provider: string) => {
        const caseType = input.caseType;
        const analysisDepth = input.analysisDepth;

        let providerSpecific = '';

        if (provider === 'perplexity') {
            providerSpecific = `\n\nIMPORTANT: Include citations to relevant precedents and statutes for each section.`;
        } else if (provider === 'anthropic') {
            providerSpecific = `\n\nFocus on the broader legal principles and their implications for future cases.`;
        }

        return `Create a detailed outline for a ${caseType} case summary.

Case Details:
- Case Name: ${input.caseName}
- Citation: ${input.citation}
- Court: ${input.court}
- Date: ${input.dateDecided}
- Judge(s): ${input.judges || 'Not specified'}

Requirements:
- Case Type: ${caseType}
- Analysis Depth: ${analysisDepth}
- Include Dissenting Opinions: ${input.includeDissent ? 'Yes' : 'No'}
- Focus on Procedural History: ${input.proceduralFocus ? 'Yes' : 'No'}
${providerSpecific}

Generate a JSON outline with the following structure:
{
  "title": "Case summary title",
  "sections": {
    "case_caption": {
      "title": "Case Caption",
      "content_points": ["Full case name", "Citation", "Court", "Date"],
      "formatting": "header"
    },
    "facts": {
      "title": "Facts of the Case",
      "content_points": ["Background", "Key events", "Parties involved"],
      "subsections": ["Background", "Dispute", "Lower Court Proceedings"]
    },
    "issues": {
      "title": "Legal Issues",
      "content_points": ["Primary issue", "Secondary issues"],
      "formatting": "numbered_list"
    },
    "holdings": {
      "title": "Holdings",
      "content_points": ["Main holding", "Subsidiary holdings"],
      "formatting": "emphasized"
    },
    "reasoning": {
      "title": "Court's Reasoning",
      "content_points": ["Legal analysis", "Precedents cited", "Policy considerations"],
      "subsections": ["Majority Opinion", "Concurrences", "Dissents"]
    },
    "impact": {
      "title": "Impact and Significance",
      "content_points": ["Immediate impact", "Future implications", "Related cases"]
    }
  }
}`;
    },

    // Section generation prompt
    section: (
        sectionId: string,
        sectionOutline: any,
        fullOutline: any,
        originalInput: CaseSummaryInput,
        previousSections?: Record<string, string>
    ) => {
        const analysisDepth = originalInput.analysisDepth;

        let contextPrompt = '';
        if (previousSections && Object.keys(previousSections).length > 0) {
            contextPrompt = `\n\nPrevious sections have covered: ${Object.keys(previousSections).join(', ')}. 
Build on this foundation without repetition.`;
        }

        return `Write the "${sectionOutline.title}" section of the case summary.

Section Details:
${JSON.stringify(sectionOutline, null, 2)}

Case: ${originalInput.caseName}
Analysis Depth: ${analysisDepth}
${contextPrompt}

Writing Requirements:
1. Use proper legal citation format
2. Be precise with legal terminology
3. ${analysisDepth === 'detailed' ? 'Include extensive analysis and context' : 'Keep analysis concise and focused'}
4. Maintain objectivity while noting important interpretations
5. Use clear topic sentences and transitions

Format appropriately based on the section type (${sectionOutline.formatting || 'paragraph'}).`;
    },

    // Refinement prompt
    refinement: (content: string, input: CaseSummaryInput) => {
        return `Review and refine this case summary for ${input.caseName}.

Current content:
${content}

Refinement goals:
1. Ensure all legal citations are properly formatted
2. Verify accuracy of legal principles stated
3. Improve clarity without losing legal precision
4. Ensure consistent analysis depth (${input.analysisDepth})
5. Check for any contradictions or unclear reasoning
6. Strengthen transitions between sections
7. ${input.includeDissent ? 'Ensure dissenting opinions are fairly represented' : 'Focus on majority opinion'}

Make minimal changes - only improve accuracy, clarity, and legal soundness.`;
    },

    // Provider-specific generation methods
    generateWithProvider: {
        perplexity: (input: CaseSummaryInput) => {
            return `Research and analyze the case ${input.caseName}. Find all relevant precedents, statutes, and subsequent cases that cite this decision. Include proper legal citations throughout.`;
        },

        anthropic: (input: CaseSummaryInput) => {
            return `Analyze ${input.caseName} with attention to its broader legal significance, the evolution of the legal principles involved, and its place in the development of ${input.caseType} law.`;
        },

        gemini: (input: CaseSummaryInput) => {
            return `Create a comprehensive analysis of ${input.caseName} that covers all aspects of the case while maintaining clear organization and accessibility for legal professionals and students alike.`;
        },
    }
};

// Helper functions
export function getCaseSummaryPrompt(
    type: 'outline' | 'section' | 'refinement',
    provider: string,
    ...args: any[]
) {
    switch (type) {
        case 'outline':
            return caseSummaryPrompts.outline(args[0], provider);
        case 'section':
            return caseSummaryPrompts.section(...args);
        case 'refinement':
            return caseSummaryPrompts.refinement(...args);
        default:
            throw new Error(`Unknown prompt type: ${type}`);
    }
}

// Provider-optimized settings
export const caseSummarySettings = {
    openai: {
        model: 'gpt-4-turbo',
        temperature: 0.3, // Lower for legal accuracy
        maxTokens: 4000,
    },
    anthropic: {
        model: 'claude-3-sonnet',
        temperature: 0.4,
        maxTokens: 4000,
    },
    gemini: {
        model: 'gemini-1.5-pro',
        temperature: 0.3,
        maxTokens: 8000,
    },
    perplexity: {
        model: 'sonar-large',
        temperature: 0.2, // Very low for factual accuracy
        maxTokens: 4000,
    },
    llama: {
        model: 'llama-3-70b',
        temperature: 0.3,
        maxTokens: 4000,
    },
};