// src/server/services/llm/prompts/biography.ts
import { z } from 'zod';
import { biographySchema } from '~/config/schemas/biography';

type BiographyInput = z.infer<typeof biographySchema>;

export const biographyPrompts = {
    // System prompts optimized per provider
    systemPrompts: {
        openai: `You are an expert biographer with decades of experience writing compelling life stories. You excel at finding the narrative thread that makes each person's journey unique and engaging.`,

        anthropic: `You are a thoughtful biographer who creates nuanced, deeply human portraits. You have a gift for capturing not just achievements, but the character, struggles, and growth that define a person's life journey.`,

        gemini: `You are a comprehensive biographer who excels at research and creating well-rounded life stories. You balance factual accuracy with engaging narrative, ensuring every biography is both informative and captivating.`,

        perplexity: `You are a research-focused biographer who creates accurate, well-sourced biographical content. You excel at finding and synthesizing information from multiple sources to create authoritative biographies.`,

        llama: `You are a skilled biographer who creates clear, engaging life stories. You focus on authenticity and accessibility, making each person's story relatable and inspiring.`
    },

    // Outline generation prompt
    outline: (input: BiographyInput, provider: string) => {
        const focusAreas = input.focusAreas.join(', ');
        const tone = input.tone;
        const purpose = input.purpose;

        let providerSpecific = '';

        if (provider === 'perplexity') {
            providerSpecific = `\n\nIMPORTANT: Include suggestions for sources that could be researched for each section.`;
        } else if (provider === 'anthropic') {
            providerSpecific = `\n\nFocus on creating a narrative arc that shows growth, challenges overcome, and the subject's impact on others.`;
        }

        return `Create a detailed outline for a ${purpose} biography of ${input.subject.name}.

Subject Details:
- Name: ${input.subject.name}
- Occupation: ${input.subject.occupation || 'Not specified'}
- Birth Date: ${input.subject.birthDate || 'Not specified'}
- Birth Place: ${input.subject.birthPlace || 'Not specified'}

Requirements:
- Purpose: ${purpose} biography
- Tone: ${tone}
- Length: ${input.outputLength} (approximately ${getLengthInWords(input.outputLength)} words)
- Focus Areas: ${focusAreas}

Additional Context:
${input.additionalInfo || 'None provided'}
${providerSpecific}

Generate a JSON outline with the following structure:
{
  "title": "Suggested biography title",
  "introduction": {
    "hook": "Opening sentence or paragraph idea",
    "thesis": "Main theme or thread of the biography",
    "preview": "What the reader will learn"
  },
  "sections": {
    "section_id": {
      "title": "Section Title",
      "content_points": ["key point 1", "key point 2"],
      "estimated_words": 500,
      "narrative_purpose": "What this section accomplishes in the overall story"
    }
  },
  "conclusion": {
    "summary": "Key takeaways",
    "legacy": "Lasting impact or message",
    "call_to_action": "If applicable"
  }
}

Ensure the outline:
1. Follows a logical chronological or thematic flow
2. Emphasizes the requested focus areas
3. Matches the requested tone and purpose
4. Creates a compelling narrative arc
5. Allocates words appropriately across sections`;
    },

    // Section generation prompt
    section: (
        sectionId: string,
        sectionOutline: any,
        fullOutline: any,
        originalInput: BiographyInput,
        previousSections?: Record<string, string>
    ) => {
        const tone = originalInput.tone;
        const purpose = originalInput.purpose;

        let contextPrompt = '';
        if (previousSections && Object.keys(previousSections).length > 0) {
            contextPrompt = `\n\nPrevious sections have covered: ${Object.keys(previousSections).join(', ')}. 
Ensure this section builds on what came before and avoids repetition.`;
        }

        return `Write the "${sectionOutline.title}" section of the biography.

Section Details:
${JSON.stringify(sectionOutline, null, 2)}

Writing Requirements:
- Tone: ${tone}
- Purpose: ${purpose} biography
- Approximate length: ${sectionOutline.estimated_words} words
- Narrative purpose: ${sectionOutline.narrative_purpose}

Subject: ${originalInput.subject.name} (${originalInput.subject.occupation || 'occupation not specified'})
${contextPrompt}

Write this section with:
1. Engaging opening that connects to the overall narrative
2. Specific details and examples (create plausible ones if needed)
3. Smooth transitions between ideas
4. Emotional resonance appropriate to the tone
5. Clear connection to the biography's overall theme

Remember: This is a ${purpose} biography with a ${tone} tone. Adjust your writing style accordingly.`;
    },

    // Refinement prompt for final polish
    refinement: (content: string, input: BiographyInput) => {
        return `Review and refine this ${input.purpose} biography of ${input.subject.name}.

Current content:
${content}

Refinement goals:
1. Ensure consistent ${input.tone} tone throughout
2. Smooth any rough transitions between sections
3. Strengthen the narrative arc
4. Check factual consistency
5. Enhance emotional impact where appropriate
6. Ensure it serves its ${input.purpose} purpose effectively

Make minimal changes - only improve flow, consistency, and impact. Maintain all factual content and overall structure.`;
    },

    // Provider-specific generation methods
    generateWithProvider: {
        // Perplexity: Emphasize research and facts
        perplexity: (input: BiographyInput) => {
            return `Research and write a biography of ${input.subject.name}. Focus on finding accurate, verifiable information about their ${input.focusAreas.join(', ')}. Include relevant dates, places, and achievements. Cite sources where possible.`;
        },

        // Anthropic: Emphasize narrative and human elements
        anthropic: (input: BiographyInput) => {
            return `Craft a deeply human biography of ${input.subject.name} that goes beyond mere facts to capture their essence, struggles, growth, and impact on others. Focus especially on ${input.focusAreas.join(', ')} with ${input.tone} tone.`;
        },

        // Gemini: Comprehensive and balanced
        gemini: (input: BiographyInput) => {
            return `Create a comprehensive biography of ${input.subject.name} that balances factual accuracy with engaging storytelling. Cover ${input.focusAreas.join(', ')} thoroughly while maintaining ${input.tone} tone throughout.`;
        },
    }
};

// Helper functions
function getLengthInWords(length: 'short' | 'medium' | 'long'): string {
    const lengths = {
        short: '800-1,200',
        medium: '1,500-2,500',
        long: '3,000-5,000'
    };
    return lengths[length];
}

// Example of using different prompts for different providers
export function getBiographyPrompt(
    type: 'outline' | 'section' | 'refinement',
    provider: string,
    ...args: any[]
) {
    switch (type) {
        case 'outline':
            return biographyPrompts.outline(args[0], provider);
        case 'section':
            return biographyPrompts.section(args[0], args[1], args[2], args[3], args[4]);
        case 'refinement':
            return biographyPrompts.refinement(args[0], args[1]);
        default:
            throw new Error(`Unknown prompt type: ${type}`);
    }
}

// Provider-optimized settings
export const biographySettings = {
    openai: {
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 4000,
    },
    anthropic: {
        model: 'claude-3-sonnet',
        temperature: 0.8,
        maxTokens: 4000,
    },
    gemini: {
        model: 'gemini-1.5-pro',
        temperature: 0.7,
        maxTokens: 8000,
    },
    perplexity: {
        model: 'sonar-large',
        temperature: 0.6,
        maxTokens: 4000,
    },
    llama: {
        model: 'llama-3-70b',
        temperature: 0.7,
        maxTokens: 4000,
    },
};