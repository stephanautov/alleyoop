// src/server/services/llm/chains/outline.ts
import { z } from 'zod';
import { DocumentType } from '@prisma/client';
import { LLMProvider } from '../base';
import { ProviderName } from '../index';
import { documentTypePrompts } from '../prompts';

// Schema for outline structure
export const outlineSchema = z.object({
  title: z.string(),
  introduction: z.object({
    hook: z.string(),
    thesis: z.string(),
    preview: z.string(),
  }),
  sections: z.record(z.object({
    title: z.string(),
    description: z.string(),
    keyPoints: z.array(z.string()),
    estimatedWords: z.number(),
    order: z.number(),
  })),
  conclusion: z.object({
    summary: z.string(),
    callToAction: z.string().optional(),
  }),
  metadata: z.object({
    totalSections: z.number(),
    estimatedTotalWords: z.number(),
    suggestedTone: z.string(),
  }),
});

export type DocumentOutline = z.infer<typeof outlineSchema>;

export class OutlineChain {
  constructor(
    private provider: LLMProvider,
    private providerName: ProviderName,
    private model: string
  ) {}

  async generate(params: {
    documentType: DocumentType;
    input: any;
    systemPrompt?: string;
  }): Promise<DocumentOutline> {
    // Get document-specific prompt builder
    const promptBuilder = documentTypePrompts[params.documentType];
    if (!promptBuilder) {
      throw new Error(`No prompt builder found for document type: ${params.documentType}`);
    }

    // Build the outline prompt
    const prompt = promptBuilder.outline(params.input, this.providerName);
    
    // Get provider-specific system prompt
    const systemPrompt = params.systemPrompt || 
      promptBuilder.systemPrompts?.[this.providerName] ||
      'You are an expert document writer. Generate detailed outlines in valid JSON format.';

    // Generate with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await this.provider.generateCompletion({
          prompt: this.enhancePromptForProvider(prompt),
          model: this.model,
          temperature: this.getOptimalTemperature('outline'),
          maxTokens: 2000,
          systemPrompt,
        });

        // Parse and validate the response
        const outline = await this.parseOutline(response.content);
        
        // Validate against schema
        const validated = outlineSchema.parse(outline);
        
        // Post-process based on provider
        return this.postProcessOutline(validated, params.documentType);
        
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to generate valid outline after ${maxAttempts} attempts: ${error}`);
        }
        // Add exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    throw new Error('Failed to generate outline');
  }

  private enhancePromptForProvider(basePrompt: string): string {
    // Provider-specific prompt enhancements
    const enhancements: Record<ProviderName, string> = {
      openai: '\n\nReturn the outline as valid JSON that can be parsed with JSON.parse().',
      anthropic: '\n\nThink step by step about the document structure, then return a well-formatted JSON outline.',
      gemini: '\n\nAnalyze the requirements comprehensively, then generate a structured JSON outline.',
      perplexity: '\n\nConsider current best practices and return a JSON outline with relevant sections.',
      llama: '\n\nGenerate a clear, structured JSON outline following the specified format exactly.',
    };

    return basePrompt + (enhancements[this.providerName] || enhancements.openai);
  }

  private async parseOutline(content: string): Promise<any> {
    // Try to extract JSON from the response
    let jsonString = content;

    // Handle responses wrapped in markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    }

    // Handle responses with explanatory text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch && !codeBlockMatch) {
      jsonString = jsonMatch[0];
    }

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      // If JSON parsing fails, try to extract structure manually
      return this.extractOutlineFromText(content);
    }
  }

  private extractOutlineFromText(text: string): any {
    // Fallback parser for non-JSON responses
    const sections: Record<string, any> = {};
    const lines = text.split('\n');
    let currentSection = '';
    let sectionOrder = 0;

    // Simple pattern matching for common outline structures
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match section headers (1. Introduction, ## Introduction, etc.)
      const sectionMatch = trimmed.match(/^(?:\d+\.|#{1,3}|-)?\s*([A-Za-z\s]+)(?::)?$/);
      if (sectionMatch && trimmed.length < 50) {
        currentSection = sectionMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        sections[currentSection] = {
          title: sectionMatch[1].trim(),
          description: '',
          keyPoints: [],
          estimatedWords: 500,
          order: sectionOrder++,
        };
      } else if (currentSection && trimmed && !trimmed.match(/^(?:\d+\.|#{1,3}|-)/)) {
        // Add content to current section
        if (!sections[currentSection].description) {
          sections[currentSection].description = trimmed;
        } else {
          sections[currentSection].keyPoints.push(trimmed);
        }
      }
    }

    return {
      title: 'Generated Document',
      introduction: {
        hook: 'Engaging opening statement',
        thesis: 'Main theme of the document',
        preview: 'Overview of what follows',
      },
      sections,
      conclusion: {
        summary: 'Key takeaways',
        callToAction: 'Next steps',
      },
      metadata: {
        totalSections: Object.keys(sections).length,
        estimatedTotalWords: Object.keys(sections).length * 500,
        suggestedTone: 'professional',
      },
    };
  }

  private postProcessOutline(
    outline: DocumentOutline,
    documentType: DocumentType
  ): DocumentOutline {
    // Add document-type specific adjustments
    switch (documentType) {
      case DocumentType.BIOGRAPHY:
        // Ensure chronological order for biography sections
        const chronologicalOrder = ['early_life', 'education', 'career', 'achievements', 'legacy'];
        let order = 0;
        for (const section of chronologicalOrder) {
          if (outline.sections[section]) {
            outline.sections[section].order = order++;
          }
        }
        break;

      case DocumentType.BUSINESS_PLAN:
        // Ensure financial sections are properly weighted
        if (outline.sections.financial_projections) {
          outline.sections.financial_projections.estimatedWords = 
            Math.max(outline.sections.financial_projections.estimatedWords, 800);
        }
        break;

      case DocumentType.GRANT_PROPOSAL:
        // Ensure budget section exists
        if (!outline.sections.budget) {
          outline.sections.budget = {
            title: 'Budget Justification',
            description: 'Detailed budget breakdown and justification',
            keyPoints: ['Personnel costs', 'Equipment', 'Operations', 'Indirect costs'],
            estimatedWords: 600,
            order: Object.keys(outline.sections).length,
          };
        }
        break;
    }

    // Recalculate total words
    outline.metadata.estimatedTotalWords = Object.values(outline.sections)
      .reduce((sum, section) => sum + section.estimatedWords, 0);

    return outline;
  }

  private getOptimalTemperature(stage: 'outline' | 'section' | 'refinement'): number {
    // Provider and stage-specific temperature settings
    const temperatures: Record<ProviderName, Record<string, number>> = {
      openai: { outline: 0.7, section: 0.8, refinement: 0.3 },
      anthropic: { outline: 0.7, section: 0.8, refinement: 0.4 },
      gemini: { outline: 0.6, section: 0.7, refinement: 0.3 },
      perplexity: { outline: 0.5, section: 0.6, refinement: 0.3 },
      llama: { outline: 0.7, section: 0.8, refinement: 0.4 },
    };

    return temperatures[this.providerName]?.[stage] || 0.7;
  }

  // Utility method to get section order
  getSectionOrder(outline: DocumentOutline): string[] {
    return Object.entries(outline.sections)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key]) => key);
  }

  // Estimate tokens for the outline
  estimateTokens(outline: DocumentOutline): number {
    const text = JSON.stringify(outline);
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }
}