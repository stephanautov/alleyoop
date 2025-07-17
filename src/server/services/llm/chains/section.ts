// src/server/services/llm/chains/section.ts
import { DocumentType } from '@prisma/client';
import { LLMProvider } from '../base';
import { ProviderName } from '../index';
import { DocumentOutline } from './outline';
import { documentTypePrompts } from '../prompts';
import { TextSplitter } from '../utils/splitter';

export interface SectionContext {
  outline: DocumentOutline;
  previousSections: Record<string, string>;
  currentSection: string;
  sectionDetails: any;
  documentType: DocumentType;
  originalInput: any;
  targetWords: number;
}

export interface SectionResult {
  content: string;
  wordCount: number;
  keyPointsCovered: string[];
  suggestedRevisions?: string[];
}

export class SectionChain {
  private textSplitter: TextSplitter;

  constructor(
    private provider: LLMProvider,
    private providerName: ProviderName,
    private model: string
  ) {
    this.textSplitter = new TextSplitter();
  }

  async generate(context: SectionContext): Promise<SectionResult> {
    // Get document-specific prompt builder
    const promptBuilder = documentTypePrompts[context.documentType];
    if (!promptBuilder?.section) {
      throw new Error(`No section prompt builder found for document type: ${context.documentType}`);
    }

    // Build context-aware prompt
    const prompt = this.buildSectionPrompt(context, promptBuilder);
    
    // Calculate optimal token allocation
    const maxTokens = this.calculateMaxTokens(context.targetWords);

    // Generate with provider-specific optimizations
    const response = await this.generateWithOptimizations({
      prompt,
      maxTokens,
      context,
    });

    // Post-process the content
    const processed = await this.postProcessContent(response.content, context);

    // Validate section meets requirements
    const validation = this.validateSection(processed, context);
    
    if (!validation.isValid) {
      // Attempt to fix common issues
      processed.content = await this.attemptAutoFix(processed, validation, context);
    }

    return processed;
  }

  private buildSectionPrompt(
    context: SectionContext,
    promptBuilder: any
  ): string {
    // Base prompt from document type
    let prompt = promptBuilder.section(
      context.currentSection,
      context.sectionDetails,
      context.outline,
      context.originalInput,
      context.previousSections
    );

    // Add provider-specific instructions
    prompt = this.enhanceForProvider(prompt, context);

    // Add context about previous sections to maintain coherence
    if (Object.keys(context.previousSections).length > 0) {
      const previousSummary = this.summarizePreviousSections(context.previousSections);
      prompt += `\n\nPrevious sections summary for context:\n${previousSummary}`;
    }

    // Add specific word count guidance
    prompt += `\n\nTarget length: approximately ${context.targetWords} words.`;
    prompt += `\nEnsure the content is substantial and detailed while maintaining engagement.`;

    return prompt;
  }

  private enhanceForProvider(prompt: string, context: SectionContext): string {
    const enhancements: Record<ProviderName, (p: string, c: SectionContext) => string> = {
      openai: (p, c) => p + '\n\nUse clear structure with smooth transitions between ideas.',
      
      anthropic: (p, c) => p + '\n\nFocus on creating nuanced, thoughtful content that demonstrates deep understanding.',
      
      gemini: (p, c) => p + '\n\nProvide comprehensive coverage with specific examples and detailed explanations.',
      
      perplexity: (p, c) => {
        if (c.documentType === DocumentType.CASE_SUMMARY || c.documentType === DocumentType.GRANT_PROPOSAL) {
          return p + '\n\nInclude relevant citations and references where appropriate.';
        }
        return p + '\n\nIncorporate current information and best practices.';
      },
      
      llama: (p, c) => p + '\n\nWrite clearly and concisely while meeting the word count target.',
    };

    const enhance = enhancements[this.providerName] || enhancements.openai;
    return enhance(prompt, context);
  }

  private async generateWithOptimizations(params: {
    prompt: string;
    maxTokens: number;
    context: SectionContext;
  }): Promise<{ content: string }> {
    // Provider-specific generation settings
    const settings = this.getProviderSettings(params.context);

    // For long sections, we might need to generate in chunks
    if (params.maxTokens > 3000 && this.supportsLongGeneration()) {
      return this.generateLongSection(params);
    }

    // Standard generation
    const response = await this.provider.generateCompletion({
      prompt: params.prompt,
      model: this.model,
      temperature: settings.temperature,
      maxTokens: params.maxTokens,
      systemPrompt: settings.systemPrompt,
    });

    return { content: response.content };
  }

  private async generateLongSection(params: {
    prompt: string;
    maxTokens: number;
    context: SectionContext;
  }): Promise<{ content: string }> {
    // Break down section into subsections for generation
    const subsections = this.planSubsections(params.context);
    const parts: string[] = [];

    for (const subsection of subsections) {
      const subPrompt = `${params.prompt}\n\nFocus specifically on: ${subsection.focus}`;
      
      const response = await this.provider.generateCompletion({
        prompt: subPrompt,
        model: this.model,
        temperature: 0.7,
        maxTokens: Math.min(2000, params.maxTokens / subsections.length),
      });

      parts.push(response.content);
    }

    // Combine and smooth transitions
    return { content: this.combineSubsections(parts) };
  }

  private planSubsections(context: SectionContext): Array<{ focus: string; words: number }> {
    const keyPoints = context.sectionDetails.keyPoints || [];
    const wordsPerPoint = Math.floor(context.targetWords / Math.max(keyPoints.length, 1));

    return keyPoints.map(point => ({
      focus: point,
      words: wordsPerPoint,
    }));
  }

  private combineSubsections(parts: string[]): string {
    // Simple combination with transition phrases
    const transitions = [
      'Furthermore, ',
      'Additionally, ',
      'Moreover, ',
      'Building on this, ',
      'In relation to this, ',
    ];

    return parts.map((part, index) => {
      if (index === 0) return part;
      const transition = transitions[index % transitions.length];
      // Add transition if the part doesn't already start with one
      if (!part.match(/^(Furthermore|Additionally|Moreover|However|In addition)/i)) {
        return transition + part.charAt(0).toLowerCase() + part.slice(1);
      }
      return part;
    }).join('\n\n');
  }

  private summarizePreviousSections(previousSections: Record<string, string>): string {
    // Create a brief summary of key points from previous sections
    const summaries: string[] = [];
    
    for (const [sectionId, content] of Object.entries(previousSections)) {
      // Extract first and last sentences as summary
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        const summary = sentences.length > 3 
          ? `${sentences[0]} [...] ${sentences[sentences.length - 1]}`
          : sentences.join(' ');
        summaries.push(`${sectionId}: ${summary.trim()}`);
      }
    }

    return summaries.join('\n');
  }

  private async postProcessContent(
    content: string,
    context: SectionContext
  ): Promise<SectionResult> {
    // Clean up content
    let processed = content.trim();

    // Fix common formatting issues
    processed = this.fixFormatting(processed);

    // Count words accurately
    const wordCount = this.countWords(processed);

    // Extract key points covered
    const keyPointsCovered = this.extractKeyPoints(processed, context.sectionDetails.keyPoints || []);

    // Identify potential improvements
    const suggestedRevisions = this.identifyRevisions(processed, context);

    return {
      content: processed,
      wordCount,
      keyPointsCovered,
      suggestedRevisions: suggestedRevisions.length > 0 ? suggestedRevisions : undefined,
    };
  }

  private fixFormatting(content: string): string {
    // Fix double spaces
    content = content.replace(/  +/g, ' ');
    
    // Fix paragraph spacing
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // Ensure sentences end with proper punctuation
    content = content.replace(/([a-zA-Z])\n/g, '$1.\n');
    
    // Fix quote formatting
    content = content.replace(/``/g, '"').replace(/''/g, '"');
    
    return content;
  }

  private countWords(content: string): number {
    // More accurate word counting
    return content
      .replace(/[^\w\s]|_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 0).length;
  }

  private extractKeyPoints(content: string, expectedPoints: string[]): string[] {
    const covered: string[] = [];
    const contentLower = content.toLowerCase();

    for (const point of expectedPoints) {
      // Check if key point is mentioned (fuzzy matching)
      const keywords = point.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matches = keywords.filter(keyword => contentLower.includes(keyword));
      
      if (matches.length >= keywords.length * 0.5) {
        covered.push(point);
      }
    }

    return covered;
  }

  private identifyRevisions(content: string, context: SectionContext): string[] {
    const suggestions: string[] = [];

    // Check word count
    const wordCount = this.countWords(content);
    const targetWords = context.targetWords;
    
    if (wordCount < targetWords * 0.8) {
      suggestions.push(`Section is ${targetWords - wordCount} words short of target`);
    } else if (wordCount > targetWords * 1.3) {
      suggestions.push(`Section exceeds target by ${wordCount - targetWords} words`);
    }

    // Check key points coverage
    const expectedPoints = context.sectionDetails.keyPoints || [];
    const covered = this.extractKeyPoints(content, expectedPoints);
    const missing = expectedPoints.filter(p => !covered.includes(p));
    
    if (missing.length > 0) {
      suggestions.push(`Missing key points: ${missing.join(', ')}`);
    }

    // Check for repetition with previous sections
    if (this.hasSignificantOverlap(content, context.previousSections)) {
      suggestions.push('Content may overlap with previous sections');
    }

    return suggestions;
  }

  private hasSignificantOverlap(content: string, previousSections: Record<string, string>): boolean {
    // Simple check for repeated phrases
    const currentPhrases = this.extractPhrases(content);
    
    for (const prevContent of Object.values(previousSections)) {
      const prevPhrases = this.extractPhrases(prevContent);
      const overlap = currentPhrases.filter(phrase => prevPhrases.includes(phrase));
      
      if (overlap.length > currentPhrases.length * 0.2) {
        return true;
      }
    }

    return false;
  }

  private extractPhrases(text: string, phraseLength: number = 5): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const phrases: string[] = [];
    
    for (let i = 0; i <= words.length - phraseLength; i++) {
      phrases.push(words.slice(i, i + phraseLength).join(' '));
    }
    
    return phrases;
  }

  private validateSection(result: SectionResult, context: SectionContext): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check minimum word count
    if (result.wordCount < context.targetWords * 0.7) {
      issues.push('Content is significantly shorter than target');
    }

    // Check key points coverage
    const expectedPoints = context.sectionDetails.keyPoints || [];
    const coverageRatio = result.keyPointsCovered.length / Math.max(expectedPoints.length, 1);
    
    if (coverageRatio < 0.6) {
      issues.push('Insufficient coverage of key points');
    }

    // Check content quality indicators
    if (!this.hasProperStructure(result.content)) {
      issues.push('Content lacks proper paragraph structure');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  private hasProperStructure(content: string): boolean {
    // Check for paragraph breaks
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length < 2) return false;

    // Check for very short or very long paragraphs
    for (const para of paragraphs) {
      const words = this.countWords(para);
      if (words < 20 || words > 300) return false;
    }

    return true;
  }

  private async attemptAutoFix(
    result: SectionResult,
    validation: { issues: string[] },
    context: SectionContext
  ): Promise<string> {
    // For minor issues, try to fix automatically
    let content = result.content;

    for (const issue of validation.issues) {
      if (issue.includes('shorter than target')) {
        // Add elaboration prompt
        const elaborationPrompt = `Expand the following content to approximately ${context.targetWords} words by adding more detail and examples:\n\n${content}`;
        
        const response = await this.provider.generateCompletion({
          prompt: elaborationPrompt,
          model: this.model,
          temperature: 0.7,
          maxTokens: 1000,
        });

        content = response.content;
      }
    }

    return content;
  }

  private getProviderSettings(context: SectionContext): {
    temperature: number;
    systemPrompt?: string;
  } {
    // Provider and document-type specific settings
    const settings: Record<ProviderName, any> = {
      openai: {
        temperature: 0.8,
        systemPrompt: 'You are an expert writer creating engaging, detailed content.',
      },
      anthropic: {
        temperature: 0.8,
        systemPrompt: 'You are a thoughtful writer who creates nuanced, human-centered content.',
      },
      gemini: {
        temperature: 0.7,
        systemPrompt: 'You are a comprehensive writer who provides detailed, well-researched content.',
      },
      perplexity: {
        temperature: 0.6,
        systemPrompt: 'You are a research-focused writer who creates accurate, well-sourced content.',
      },
      llama: {
        temperature: 0.8,
        systemPrompt: 'You are a clear, effective writer who creates accessible content.',
      },
    };

    return settings[this.providerName] || settings.openai;
  }

  private calculateMaxTokens(targetWords: number): number {
    // Rough conversion: 1 word ≈ 1.3 tokens
    const targetTokens = Math.ceil(targetWords * 1.3);
    
    // Add buffer for better results
    const withBuffer = targetTokens * 1.2;
    
    // Respect model limits
    const modelLimits: Record<string, number> = {
      'gpt-4-turbo': 4096,
      'claude-3': 4096,
      'gemini-1.5-pro': 8192,
      'llama-3-70b': 4096,
    };

    const limit = modelLimits[this.model] || 4096;
    return Math.min(withBuffer, limit);
  }

  private supportsLongGeneration(): boolean {
    // Some providers/models handle long content better
    return ['gemini', 'anthropic'].includes(this.providerName) ||
           this.model.includes('gemini-1.5') ||
           this.model.includes('claude-3-opus');
  }
}