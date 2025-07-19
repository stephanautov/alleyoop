// src/server/services/llm/utils/tokenizer.ts
import { encoding_for_model, Tiktoken } from '@dqbd/tiktoken';

export interface TokenCountResult {
  tokens: number;
  characters: number;
  estimatedCost?: {
    input: number;
    output: number;
  };
}

export class TokenCounter {
  private encoders: Map<string, Tiktoken> = new Map();
  
  // Token-to-character ratios for different models (approximate)
  private readonly tokenRatios: Record<string, number> = {
    'gpt-4': 3.8,
    'gpt-3.5-turbo': 4.0,
    'claude': 3.5,
    'llama': 4.0,
    'gemini': 3.8,
    default: 4.0,
  };

  /**
   * Count tokens for a given text and model
   */
  count(text: string, model?: string): TokenCountResult {
    const characters = text.length;
    
    try {
      // Try to use tiktoken for OpenAI models
      if (model && (model.includes('gpt') || model.includes('turbo'))) {
        const tokens = this.countWithTiktoken(text, model);
        return { tokens, characters };
      }
    } catch (error) {
      // Fall back to estimation if tiktoken fails
      console.warn('Tiktoken encoding failed, using estimation:', error);
    }

    // Use estimation for other models
    const tokens = this.estimate(text, model);
    return { tokens, characters };
  }

  /**
   * Count tokens using OpenAI's tiktoken library
   */
  private countWithTiktoken(text: string, model: string): number {
    let encoder = this.encoders.get(model);
    
    if (!encoder) {
      try {
        // Map model names to tiktoken encoding names
        const encodingName = this.getEncodingName(model);
        encoder = encoding_for_model(encodingName as any);
        this.encoders.set(model, encoder);
      } catch (error) {
        // If specific model encoding not found, use cl100k_base (GPT-4)
        encoder = encoding_for_model('cl100k_base' as any);
        this.encoders.set(model, encoder);
      }
    }

    const tokens = encoder.encode(text);
    return tokens.length;
  }

  /**
   * Get tiktoken encoding name for a model
   */
  private getEncodingName(model: string): string {
    if (model.includes('gpt-4')) return 'cl100k_base';
    if (model.includes('gpt-3.5')) return 'cl100k_base';
    if (model.includes('text-davinci')) return 'p50k_base';
    return 'cl100k_base'; // Default to GPT-4 encoding
  }

  /**
   * Estimate token count based on character count and model
   */
  estimate(text: string, model?: string): number {
    const ratio = this.getTokenRatio(model);
    return Math.ceil(text.length / ratio);
  }

  /**
   * Get character-to-token ratio for a model
   */
  private getTokenRatio(model?: string): number {
    if (!model) return this.tokenRatios.default;
    
    // Check exact match first
    if (this.tokenRatios[model]) {
      return this.tokenRatios[model];
    }
    
    // Check partial matches
    for (const [key, ratio] of Object.entries(this.tokenRatios)) {
      if (model.toLowerCase().includes(key)) {
        return ratio;
      }
    }
    
    return this.tokenRatios.default;
  }

  /**
   * Estimate tokens for multiple texts
   */
  countBatch(texts: string[], model?: string): TokenCountResult[] {
    return texts.map(text => this.count(text, model));
  }

  /**
   * Calculate total tokens from multiple results
   */
  sum(results: TokenCountResult[]): number {
    return results.reduce((total, result) => total + result.tokens, 0);
  }

  /**
   * Split text to fit within token limit
   */
  splitByTokens(
    text: string, 
    maxTokens: number, 
    model?: string,
    overlap: number = 100
  ): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.count(sentence, model).tokens;
      
      if (currentTokens + sentenceTokens > maxTokens) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          
          // Add overlap by including last few sentences
          const overlapText = this.getOverlapText(currentChunk, overlap, model);
          currentChunk = overlapText + ' ' + sentence;
          currentTokens = this.count(currentChunk, model).tokens;
        } else {
          // Single sentence exceeds limit, split by words
          const words = sentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            const testChunk = wordChunk + ' ' + word;
            if (this.count(testChunk, model).tokens <= maxTokens) {
              wordChunk = testChunk;
            } else {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            }
          }
          
          currentChunk = wordChunk;
          currentTokens = this.count(currentChunk, model).tokens;
        }
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get text for overlap between chunks
   */
  private getOverlapText(text: string, overlapTokens: number, model?: string): string {
    const sentences = this.splitIntoSentences(text);
    let overlapText = '';
    let tokens = 0;

    // Add sentences from the end until we reach overlap token count
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.count(sentence, model).tokens;
      
      if (tokens + sentenceTokens <= overlapTokens) {
        overlapText = sentence + ' ' + overlapText;
        tokens += sentenceTokens;
      } else {
        break;
      }
    }

    return overlapText.trim();
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Improved sentence splitting regex
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Estimate cost for token usage
   */
  estimateCost(
    tokens: number,
    model: string,
    type: 'input' | 'output' = 'input'
  ): number {
    // Pricing per 1k tokens (approximate as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
      'gemini-1.5-flash': { input: 0.00035, output: 0.00105 },
    };

    // Find matching pricing
    let modelPricing = pricing[model];
    
    if (!modelPricing) {
      // Try partial match
      for (const [key, value] of Object.entries(pricing)) {
        if (model.includes(key) || key.includes(model)) {
          modelPricing = value;
          break;
        }
      }
    }

    // Default pricing if model not found
    if (!modelPricing) {
      modelPricing = { input: 0.01, output: 0.03 };
    }

    const costPerToken = modelPricing[type] / 1000;
    return tokens * costPerToken;
  }

  /**
   * Format token count for display
   */
  format(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(2)}M`;
  }

  /**
   * Cleanup encoders to free memory
   */
  cleanup(): void {
    for (const encoder of this.encoders.values()) {
      encoder.free();
    }
    this.encoders.clear();
  }
}