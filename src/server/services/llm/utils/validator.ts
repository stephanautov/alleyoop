// src/server/services/llm/utils/validator.ts
import { z } from 'zod';
import { DocumentType } from '@prisma/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ContentValidation {
  hasMinimumLength: boolean;
  hasProperStructure: boolean;
  isCoherent: boolean;
  matchesRequirements: boolean;
  qualityScore: number;
}

export class ResponseValidator {
  /**
   * Validate LLM response against expected schema
   */
  validateJSON<T>(
    response: string,
    schema: z.ZodSchema<T>
  ): { success: boolean; data?: T; error?: string } {
    try {
      // Extract JSON from response
      const json = this.extractJSON(response);
      
      // Parse and validate with Zod
      const result = schema.safeParse(json);
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        return {
          success: false,
          error: this.formatZodError(result.error),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse JSON: ${error}`,
      };
    }
  }

  /**
   * Extract JSON from potentially mixed content
   */
  private extractJSON(text: string): any {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonString = jsonMatch[0];
    
    // Clean up common issues
    const cleaned = jsonString
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays

    return JSON.parse(cleaned);
  }

  /**
   * Format Zod validation errors
   */
  private formatZodError(error: z.ZodError): string {
    const issues = error.issues.map(issue => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });
    return issues.join('; ');
  }

  /**
   * Validate document content quality
   */
  validateContent(
    content: string,
    documentType: DocumentType,
    requirements?: {
      minWords?: number;
      maxWords?: number;
      requiredSections?: string[];
      tone?: string;
    }
  ): ContentValidation {
    const validation: ContentValidation = {
      hasMinimumLength: true,
      hasProperStructure: true,
      isCoherent: true,
      matchesRequirements: true,
      qualityScore: 0,
    };

    // Check length requirements
    const wordCount = this.countWords(content);
    if (requirements?.minWords && wordCount < requirements.minWords) {
      validation.hasMinimumLength = false;
    }
    if (requirements?.maxWords && wordCount > requirements.maxWords) {
      validation.hasMinimumLength = false;
    }

    // Check structure
    validation.hasProperStructure = this.checkStructure(content, documentType);

    // Check coherence
    validation.isCoherent = this.checkCoherence(content);

    // Check requirements
    if (requirements?.requiredSections) {
      validation.matchesRequirements = this.checkSections(content, requirements.requiredSections);
    }

    // Calculate quality score
    validation.qualityScore = this.calculateQualityScore(validation);

    return validation;
  }

  /**
   * Validate that refinement maintains document integrity
   */
  validateRefinement(
    original: string,
    refined: string
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check that content wasn't drastically reduced
    const originalWords = this.countWords(original);
    const refinedWords = this.countWords(refined);
    
    if (refinedWords < originalWords * 0.8) {
      issues.push('Refined content is significantly shorter than original');
    }

    // Check that key information is preserved
    const keyPhrases = this.extractKeyPhrases(original);
    const preservedPhrases = keyPhrases.filter(phrase =>
      refined.toLowerCase().includes(phrase.toLowerCase())
    );

    if (preservedPhrases.length < keyPhrases.length * 0.7) {
      issues.push('Key information may have been lost in refinement');
    }

    // Check for format corruption
    if (original.includes('##') && !refined.includes('##')) {
      issues.push('Section headers may have been removed');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate API response format
   */
  validateAPIResponse(response: any, provider: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Provider-specific validation
    switch (provider) {
      case 'openai':
        if (!response.choices || !Array.isArray(response.choices)) {
          result.errors.push('Invalid OpenAI response format');
          result.isValid = false;
        }
        break;

      case 'anthropic':
        if (!response.content || !Array.isArray(response.content)) {
          result.errors.push('Invalid Anthropic response format');
          result.isValid = false;
        }
        break;

      case 'gemini':
        if (!response.text || typeof response.text !== 'function') {
          result.errors.push('Invalid Gemini response format');
          result.isValid = false;
        }
        break;
    }

    return result;
  }

  /**
   * Validate document outline
   */
  validateOutline(outline: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check required fields
    if (!outline.sections || typeof outline.sections !== 'object') {
      result.errors.push('Outline must have sections object');
      result.isValid = false;
    }

    if (!outline.title) {
      result.warnings.push('Outline missing title');
    }

    // Check section structure
    if (outline.sections) {
      const sectionCount = Object.keys(outline.sections).length;
      
      if (sectionCount < 3) {
        result.warnings.push('Outline has very few sections');
        result.suggestions.push('Consider adding more sections for comprehensive coverage');
      }

      // Check each section
      Object.entries(outline.sections).forEach(([key, section]: [string, any]) => {
        if (!section.title) {
          result.errors.push(`Section ${key} missing title`);
          result.isValid = false;
        }

        if (!section.estimatedWords || section.estimatedWords < 50) {
          result.warnings.push(`Section ${key} has very low word estimate`);
        }
      });
    }

    return result;
  }

  /**
   * Check document structure
   */
  private checkStructure(content: string, documentType: DocumentType): boolean {
    // Check for basic structure elements
    const hasParagraphs = content.split('\n\n').length > 1;
    const hasHeaders = content.includes('##') || content.includes('#');
    
    // Document type specific checks
    switch (documentType) {
      case DocumentType.BUSINESS_PLAN:
        return hasHeaders && content.toLowerCase().includes('executive summary');
      
      case DocumentType.GRANT_PROPOSAL:
        return hasHeaders && content.toLowerCase().includes('budget');
      
      case DocumentType.CASE_SUMMARY:
        return hasParagraphs && (
          content.toLowerCase().includes('facts') ||
          content.toLowerCase().includes('issue') ||
          content.toLowerCase().includes('holding')
        );
      
      default:
        return hasParagraphs;
    }
  }

  /**
   * Check content coherence
   */
  private checkCoherence(content: string): boolean {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length < 3) {
      return false; // Too short to assess
    }

    // Check for repetitive phrases
    const phrases = new Set<string>();
    let repetitions = 0;

    sentences.forEach(sentence => {
      const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrases.has(phrase)) {
          repetitions++;
        }
        phrases.add(phrase);
      }
    });

    // High repetition indicates low coherence
    return repetitions < sentences.length * 0.2;
  }

  /**
   * Check required sections
   */
  private checkSections(content: string, requiredSections: string[]): boolean {
    const contentLower = content.toLowerCase();
    const foundSections = requiredSections.filter(section =>
      contentLower.includes(section.toLowerCase())
    );
    
    return foundSections.length >= requiredSections.length * 0.8;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(validation: ContentValidation): number {
    let score = 0;
    
    if (validation.hasMinimumLength) score += 0.25;
    if (validation.hasProperStructure) score += 0.25;
    if (validation.isCoherent) score += 0.25;
    if (validation.matchesRequirements) score += 0.25;
    
    return score;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .replace(/[^\w\s]|_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 0).length;
  }

  /**
   * Extract key phrases for comparison
   */
  private extractKeyPhrases(text: string, maxPhrases: number = 10): string[] {
    // Simple key phrase extraction
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const phrases: Map<string, number> = new Map();

    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }

    // Sort by frequency and return top phrases
    return Array.from(phrases.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPhrases)
      .map(([phrase]) => phrase);
  }

  /**
   * Validate token usage against limits
   */
  validateTokenUsage(
    used: number,
    limit: number,
    warningThreshold: number = 0.8
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: used <= limit,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    if (used > limit) {
      result.errors.push(`Token usage (${used}) exceeds limit (${limit})`);
    } else if (used > limit * warningThreshold) {
      result.warnings.push(`Token usage (${used}) approaching limit (${limit})`);
      result.suggestions.push('Consider using a more concise prompt or splitting the task');
    }

    return result;
  }
}