// src/server/services/llm/chains/refinement.ts
import { DocumentType } from '@prisma/client';
import { LLMProvider } from '../base';
import { ProviderName } from '../index';
import { DocumentOutline } from './outline';
import { ResponseValidator } from '../utils/validator';
import { TokenCounter } from '../utils/tokenizer';

export interface RefinementContext {
  documentType: DocumentType;
  outline: DocumentOutline;
  sections: Record<string, string>;
  originalInput: any;
  requirements: {
    tone: string;
    style: string;
    targetAudience: string;
    specialInstructions?: string;
  };
}

export interface RefinementResult {
  content: string;
  changes: {
    type: 'grammar' | 'flow' | 'consistency' | 'style' | 'factual';
    description: string;
    location?: string;
  }[];
  metadata: {
    readabilityScore: number;
    consistencyScore: number;
    toneAlignment: number;
    overallQuality: number;
  };
}

export class RefinementChain {
  private validator: ResponseValidator;
  private tokenCounter: TokenCounter;

  constructor(
    private provider: LLMProvider,
    private providerName: ProviderName,
    private model: string
  ) {
    this.validator = new ResponseValidator();
    this.tokenCounter = new TokenCounter();
  }

  async refine(context: RefinementContext): Promise<RefinementResult> {
    // Combine sections into full document
    const fullDocument = this.combineDocument(context);

    // Analyze document for issues
    const analysis = await this.analyzeDocument(fullDocument, context);

    // Perform targeted refinements based on analysis
    let refinedContent = fullDocument;
    const changes: RefinementResult['changes'] = [];

    // Stage 1: Grammar and clarity
    if (analysis.needsGrammarFix) {
      const grammarResult = await this.refineGrammar(refinedContent, context);
      refinedContent = grammarResult.content;
      changes.push(...grammarResult.changes);
    }

    // Stage 2: Flow and transitions
    if (analysis.needsFlowImprovement) {
      const flowResult = await this.refineFlow(refinedContent, context);
      refinedContent = flowResult.content;
      changes.push(...flowResult.changes);
    }

    // Stage 3: Consistency and style
    if (analysis.needsConsistencyFix) {
      const consistencyResult = await this.refineConsistency(refinedContent, context);
      refinedContent = consistencyResult.content;
      changes.push(...consistencyResult.changes);
    }

    // Stage 4: Final polish
    const finalResult = await this.finalPolish(refinedContent, context);
    
    // Calculate quality metrics
    const metadata = await this.calculateMetadata(finalResult.content, context);

    return {
      content: finalResult.content,
      changes: [...changes, ...finalResult.changes],
      metadata,
    };
  }

  private combineDocument(context: RefinementContext): string {
    const orderedSections = this.getOrderedSections(context);
    const parts: string[] = [];

    // Add title if available
    if (context.outline.title) {
      parts.push(`# ${context.outline.title}\n`);
    }

    // Add introduction
    if (context.outline.introduction) {
      const intro = this.formatIntroduction(context.outline.introduction);
      parts.push(intro);
    }

    // Add main sections
    for (const sectionId of orderedSections) {
      const content = context.sections[sectionId];
      const sectionInfo = context.outline.sections[sectionId];
      
      if (content && sectionInfo) {
        parts.push(`## ${sectionInfo.title}\n\n${content}`);
      }
    }

    // Add conclusion
    if (context.outline.conclusion) {
      const conclusion = this.formatConclusion(context.outline.conclusion);
      parts.push(conclusion);
    }

    return parts.join('\n\n');
  }

  private getOrderedSections(context: RefinementContext): string[] {
    return Object.entries(context.outline.sections)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key]) => key);
  }

  private formatIntroduction(intro: any): string {
    const parts: string[] = [];
    
    if (intro.hook) {
      parts.push(intro.hook);
    }
    
    if (intro.thesis) {
      parts.push(intro.thesis);
    }
    
    if (intro.preview) {
      parts.push(intro.preview);
    }
    
    return parts.join(' ');
  }

  private formatConclusion(conclusion: any): string {
    const parts: string[] = ['## Conclusion\n'];
    
    if (conclusion.summary) {
      parts.push(conclusion.summary);
    }
    
    if (conclusion.callToAction) {
      parts.push(conclusion.callToAction);
    }
    
    return parts.join('\n\n');
  }

  private async analyzeDocument(
    document: string,
    context: RefinementContext
  ): Promise<{
    needsGrammarFix: boolean;
    needsFlowImprovement: boolean;
    needsConsistencyFix: boolean;
    issues: string[];
  }> {
    const prompt = `Analyze this ${context.documentType} document for quality issues:

${document.substring(0, 2000)}... [truncated]

Check for:
1. Grammar and spelling errors
2. Flow and transition issues between sections
3. Consistency in tone, style, and terminology
4. Alignment with requirements: ${JSON.stringify(context.requirements)}

Return a JSON object with boolean flags and an issues array.`;

    const response = await this.provider.generateCompletion({
      prompt,
      model: this.model,
      temperature: 0.3,
      maxTokens: 500,
    });

    try {
      const analysis = JSON.parse(response.content);
      return {
        needsGrammarFix: analysis.grammarIssues || false,
        needsFlowImprovement: analysis.flowIssues || false,
        needsConsistencyFix: analysis.consistencyIssues || false,
        issues: analysis.issues || [],
      };
    } catch {
      // Default to light refinement if parsing fails
      return {
        needsGrammarFix: true,
        needsFlowImprovement: true,
        needsConsistencyFix: false,
        issues: ['Could not analyze document automatically'],
      };
    }
  }

  private async refineGrammar(
    content: string,
    context: RefinementContext
  ): Promise<{ content: string; changes: RefinementResult['changes'] }> {
    const chunks = this.splitIntoChunks(content, 2000);
    const refinedChunks: string[] = [];
    const changes: RefinementResult['changes'] = [];

    for (let i = 0; i < chunks.length; i++) {
      const prompt = `Fix grammar, spelling, and punctuation in this text while preserving the original meaning and style:

${chunks[i]}

Make minimal changes and maintain the ${context.requirements.tone} tone.`;

      const response = await this.provider.generateCompletion({
        prompt,
        model: this.model,
        temperature: 0.2,
        maxTokens: this.tokenCounter.estimate(chunks[i]) * 1.2,
      });

      refinedChunks.push(response.content);
      
      // Track changes (simplified - in production, use diff algorithm)
      if (response.content !== chunks[i]) {
        changes.push({
          type: 'grammar',
          description: `Grammar corrections in section ${i + 1}`,
          location: `Chunk ${i + 1}`,
        });
      }
    }

    return {
      content: refinedChunks.join('\n\n'),
      changes,
    };
  }

  private async refineFlow(
    content: string,
    context: RefinementContext
  ): Promise<{ content: string; changes: RefinementResult['changes'] }> {
    const prompt = `Improve the flow and transitions in this ${context.documentType} document:

${this.truncateForContext(content, 3000)}

Focus on:
1. Smooth transitions between sections
2. Logical progression of ideas
3. Consistent narrative flow
4. Clear connections between paragraphs

Maintain the same content and structure, only improve transitions and flow.`;

    const response = await this.provider.generateCompletion({
      prompt,
      model: this.model,
      temperature: 0.4,
      maxTokens: Math.min(this.tokenCounter.estimate(content) * 1.2, 4000),
    });

    const changes: RefinementResult['changes'] = [{
      type: 'flow',
      description: 'Improved transitions and document flow',
    }];

    return {
      content: response.content,
      changes,
    };
  }

  private async refineConsistency(
    content: string,
    context: RefinementContext
  ): Promise<{ content: string; changes: RefinementResult['changes'] }> {
    const prompt = `Ensure consistency throughout this document:

${this.truncateForContext(content, 3000)}

Requirements:
- Tone: ${context.requirements.tone}
- Style: ${context.requirements.style}
- Target audience: ${context.requirements.targetAudience}

Fix any inconsistencies in:
1. Terminology and naming
2. Tone and voice
3. Formatting and structure
4. Level of detail

Preserve all content while making it consistent.`;

    const response = await this.provider.generateCompletion({
      prompt,
      model: this.model,
      temperature: 0.3,
      maxTokens: Math.min(this.tokenCounter.estimate(content) * 1.2, 4000),
    });

    const changes: RefinementResult['changes'] = [{
      type: 'consistency',
      description: 'Standardized terminology and tone throughout',
    }];

    return {
      content: response.content,
      changes,
    };
  }

  private async finalPolish(
    content: string,
    context: RefinementContext
  ): Promise<{ content: string; changes: RefinementResult['changes'] }> {
    // Provider-specific final polish
    const polishPrompts: Record<ProviderName, string> = {
      openai: 'Apply final polish for clarity and professionalism.',
      anthropic: 'Refine for eloquence and emotional resonance while maintaining authenticity.',
      gemini: 'Ensure comprehensive coverage and logical completeness.',
      perplexity: 'Verify factual accuracy and add any missing context.',
      llama: 'Optimize for clarity and readability.',
    };

    const polishInstruction = polishPrompts[this.providerName] || polishPrompts.openai;

    const prompt = `${polishInstruction}

Document type: ${context.documentType}
Requirements: ${JSON.stringify(context.requirements)}

${this.truncateForContext(content, 3000)}

Make only essential improvements to perfect the document.`;

    const response = await this.provider.generateCompletion({
      prompt,
      model: this.model,
      temperature: 0.2,
      maxTokens: Math.min(this.tokenCounter.estimate(content) * 1.1, 4000),
    });

    // Validate the response maintains document integrity
    const validation = this.validator.validateRefinement(content, response.content);
    
    if (!validation.isValid) {
      // Fall back to original if refinement corrupted document
      return {
        content,
        changes: [{
          type: 'style',
          description: 'Minimal polish applied (validation failed)',
        }],
      };
    }

    return {
      content: response.content,
      changes: [{
        type: 'style',
        description: 'Final polish and optimization applied',
      }],
    };
  }

  private async calculateMetadata(
    content: string,
    context: RefinementContext
  ): Promise<RefinementResult['metadata']> {
    // Calculate readability score (simplified Flesch-Kincaid)
    const readabilityScore = this.calculateReadability(content);

    // Check consistency through repetition analysis
    const consistencyScore = this.analyzeConsistency(content);

    // Analyze tone alignment
    const toneAlignment = await this.analyzeToneAlignment(content, context.requirements.tone);

    // Overall quality is weighted average
    const overallQuality = (
      readabilityScore * 0.3 +
      consistencyScore * 0.3 +
      toneAlignment * 0.4
    );

    return {
      readabilityScore,
      consistencyScore,
      toneAlignment,
      overallQuality,
    };
  }

  private calculateReadability(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0.5;

    // Flesch Reading Ease formula (normalized to 0-1)
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    let score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    score = Math.max(0, Math.min(100, score));
    
    return score / 100;
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = /[aeiou]/.test(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e')) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  }

  private analyzeConsistency(text: string): number {
    // Check for consistent use of terms
    const termVariations = [
      ['utilize', 'use'],
      ['implement', 'create', 'build'],
      ['analyze', 'analyse'],
    ];

    let inconsistencies = 0;
    
    for (const variations of termVariations) {
      const counts = variations.map(term => 
        (text.match(new RegExp(`\\b${term}\\b`, 'gi')) || []).length
      );
      
      const usedVariations = counts.filter(c => c > 0).length;
      if (usedVariations > 1) {
        inconsistencies++;
      }
    }

    // Score decreases with more inconsistencies
    return Math.max(0, 1 - (inconsistencies * 0.1));
  }

  private async analyzeToneAlignment(
    content: string,
    targetTone: string
  ): Promise<number> {
    const sampleText = content.substring(0, 1000);
    
    const prompt = `Rate how well this text matches a ${targetTone} tone on a scale of 0-100:

"${sampleText}"

Respond with only a number.`;

    try {
      const response = await this.provider.generateCompletion({
        prompt,
        model: this.model,
        temperature: 0.1,
        maxTokens: 10,
      });

      const score = parseInt(response.content.trim());
      return isNaN(score) ? 0.7 : score / 100;
    } catch {
      return 0.7; // Default moderate alignment
    }
  }

  private splitIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Handle paragraphs larger than chunk size
        if (paragraph.length > maxChunkSize) {
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
              chunks.push(currentChunk.trim());
              currentChunk = sentence;
            } else {
              currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private truncateForContext(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const halfLength = Math.floor(maxLength / 2);
    const start = text.substring(0, halfLength);
    const end = text.substring(text.length - halfLength);
    
    return `${start}\n\n[... middle content truncated for context ...]\n\n${end}`;
  }
}