// src/server/services/llm/utils/splitter.ts
import { TokenCounter } from './tokenizer';

export interface SplitOptions {
  maxTokens?: number;
  maxCharacters?: number;
  overlap?: number;
  separator?: string | RegExp;
  keepSeparator?: boolean;
  model?: string;
}

export interface TextChunk {
  text: string;
  index: number;
  tokens: number;
  metadata?: {
    startChar: number;
    endChar: number;
    overlapWithPrevious?: number;
    overlapWithNext?: number;
  };
}

export class TextSplitter {
  private tokenCounter: TokenCounter;

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  /**
   * Split text into chunks based on token or character limits
   */
  split(text: string, options: SplitOptions = {}): TextChunk[] {
    const {
      maxTokens = 1000,
      maxCharacters = 4000,
      overlap = 100,
      separator = '\n\n',
      keepSeparator = true,
      model = 'gpt-4',
    } = options;

    // First, split by separator (usually paragraphs)
    const sections = this.splitBySeparator(text, separator, keepSeparator);
    
    // Then, group sections into chunks respecting limits
    const chunks = this.groupIntoChunks(sections, {
      maxTokens,
      maxCharacters,
      overlap,
      model,
    });

    return chunks;
  }

  /**
   * Split text by separator
   */
  private splitBySeparator(
    text: string,
    separator: string | RegExp,
    keepSeparator: boolean
  ): string[] {
    if (typeof separator === 'string') {
      if (keepSeparator) {
        // Split but keep separator at the end of each chunk
        const parts = text.split(separator);
        return parts.map((part, i) => 
          i < parts.length - 1 ? part + separator : part
        ).filter(part => part.trim().length > 0);
      } else {
        return text.split(separator).filter(part => part.trim().length > 0);
      }
    } else {
      // RegExp splitting
      const parts: string[] = [];
      let lastIndex = 0;
      let match;

      const regex = new RegExp(separator, 'g');
      while ((match = regex.exec(text)) !== null) {
        if (keepSeparator) {
          parts.push(text.slice(lastIndex, match.index + match[0].length));
        } else {
          parts.push(text.slice(lastIndex, match.index));
        }
        lastIndex = keepSeparator ? match.index + match[0].length : regex.lastIndex;
      }

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts.filter(part => part.trim().length > 0);
    }
  }

  /**
   * Group sections into chunks respecting size limits
   */
  private groupIntoChunks(
    sections: string[],
    options: {
      maxTokens: number;
      maxCharacters: number;
      overlap: number;
      model?: string;
    }
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    let currentStartChar = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionTokens = this.tokenCounter.count(section, options.model).tokens;

      // Check if adding this section would exceed limits
      if (currentChunk && (
        currentTokens + sectionTokens > options.maxTokens ||
        currentChunk.length + section.length > options.maxCharacters
      )) {
        // Save current chunk
        const chunk = this.createChunk(
          currentChunk.trim(),
          chunkIndex++,
          currentStartChar,
          options.model
        );

        // Add overlap information
        if (options.overlap > 0 && chunks.length > 0) {
          this.addOverlap(chunks[chunks.length - 1], chunk, options.overlap);
        }

        chunks.push(chunk);

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, options.overlap, options.model);
        currentChunk = overlapText ? overlapText + '\n\n' + section : section;
        currentTokens = this.tokenCounter.count(currentChunk, options.model).tokens;
        currentStartChar += currentChunk.length - overlapText.length;
      } else {
        // Add section to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + section;
        currentTokens += sectionTokens;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      const chunk = this.createChunk(
        currentChunk.trim(),
        chunkIndex,
        currentStartChar,
        options.model
      );
      
      if (options.overlap > 0 && chunks.length > 0) {
        this.addOverlap(chunks[chunks.length - 1], chunk, options.overlap);
      }
      
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create a text chunk with metadata
   */
  private createChunk(
    text: string,
    index: number,
    startChar: number,
    model?: string
  ): TextChunk {
    const tokens = this.tokenCounter.count(text, model).tokens;
    
    return {
      text,
      index,
      tokens,
      metadata: {
        startChar,
        endChar: startChar + text.length,
      },
    };
  }

  /**
   * Add overlap information between chunks
   */
  private addOverlap(previousChunk: TextChunk, currentChunk: TextChunk, overlapTokens: number): void {
    const overlapText = this.getOverlapText(previousChunk.text, overlapTokens);
    const overlapLength = overlapText.length;

    if (previousChunk.metadata) {
      previousChunk.metadata.overlapWithNext = overlapLength;
    }
    
    if (currentChunk.metadata) {
      currentChunk.metadata.overlapWithPrevious = overlapLength;
    }
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapTokens: number, model?: string): string {
    if (overlapTokens <= 0) return '';

    const sentences = this.splitIntoSentences(text);
    let overlapText = '';
    let tokens = 0;

    // Add sentences from the end until we reach overlap token count
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sentenceTokens = this.tokenCounter.count(sentence, model).tokens;
      
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
    // Improved sentence splitting that handles edge cases
    const sentenceEndings = /([.!?]+)(?:\s+|$)/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceEndings.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + match[1].length);
      if (sentence.trim()) {
        sentences.push(sentence.trim());
      }
      lastIndex = match.index + match[0].length;
    }

    // Don't forget the last part if it doesn't end with punctuation
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex).trim();
      if (remaining) {
        sentences.push(remaining);
      }
    }

    return sentences;
  }

  /**
   * Split text for semantic search (smaller chunks)
   */
  splitForEmbedding(text: string, options: {
    chunkSize?: number;
    chunkOverlap?: number;
    model?: string;
  } = {}): TextChunk[] {
    const {
      chunkSize = 200,
      chunkOverlap = 20,
      model = 'text-embedding-3-small',
    } = options;

    // For embeddings, we want smaller, more focused chunks
    return this.split(text, {
      maxTokens: chunkSize,
      overlap: chunkOverlap,
      separator: /\n{2,}|\.\s+/,
      keepSeparator: true,
      model,
    });
  }

  /**
   * Split by specific document structure (headers, sections, etc.)
   */
  splitByStructure(text: string, options: {
    headerPattern?: RegExp;
    maxTokens?: number;
    model?: string;
  } = {}): TextChunk[] {
    const {
      headerPattern = /^#{1,6}\s+.+$/gm,
      maxTokens = 2000,
      model = 'gpt-4',
    } = options;

    const chunks: TextChunk[] = [];
    const headers = Array.from(text.matchAll(headerPattern));
    let lastIndex = 0;
    let chunkIndex = 0;

    for (const header of headers) {
      const headerIndex = header.index!;
      
      // Get content from last position to current header
      if (headerIndex > lastIndex) {
        const content = text.slice(lastIndex, headerIndex).trim();
        if (content) {
          const contentChunks = this.split(content, { maxTokens, model });
          contentChunks.forEach(chunk => {
            chunk.index = chunkIndex++;
            chunks.push(chunk);
          });
        }
      }

      lastIndex = headerIndex;
    }

    // Don't forget the last section
    if (lastIndex < text.length) {
      const content = text.slice(lastIndex).trim();
      if (content) {
        const contentChunks = this.split(content, { maxTokens, model });
        contentChunks.forEach(chunk => {
          chunk.index = chunkIndex++;
          chunks.push(chunk);
        });
      }
    }

    return chunks;
  }

  /**
   * Merge small chunks to optimize API calls
   */
  mergeChunks(chunks: TextChunk[], options: {
    maxTokens?: number;
    maxCharacters?: number;
    model?: string;
  } = {}): TextChunk[] {
    const {
      maxTokens = 2000,
      maxCharacters = 8000,
      model = 'gpt-4',
    } = options;

    const merged: TextChunk[] = [];
    let currentMerged: TextChunk | null = null;

    for (const chunk of chunks) {
      if (!currentMerged) {
        currentMerged = { ...chunk };
        continue;
      }

      const combinedTokens = currentMerged.tokens + chunk.tokens;
      const combinedLength = currentMerged.text.length + chunk.text.length + 2; // +2 for separator

      if (combinedTokens <= maxTokens && combinedLength <= maxCharacters) {
        // Merge chunks
        currentMerged.text += '\n\n' + chunk.text;
        currentMerged.tokens = combinedTokens;
        if (currentMerged.metadata && chunk.metadata) {
          currentMerged.metadata.endChar = chunk.metadata.endChar;
        }
      } else {
        // Save current and start new
        merged.push(currentMerged);
        currentMerged = { ...chunk };
      }
    }

    if (currentMerged) {
      merged.push(currentMerged);
    }

    // Re-index
    merged.forEach((chunk, index) => {
      chunk.index = index;
    });

    return merged;
  }

  /**
   * Extract context window for a specific position
   */
  extractContextWindow(
    text: string,
    position: number,
    windowSize: number,
    options: {
      unit?: 'tokens' | 'characters';
      model?: string;
    } = {}
  ): string {
    const { unit = 'tokens', model = 'gpt-4' } = options;

    if (unit === 'characters') {
      const start = Math.max(0, position - Math.floor(windowSize / 2));
      const end = Math.min(text.length, position + Math.floor(windowSize / 2));
      return text.slice(start, end);
    }

    // Token-based window extraction
    const sentences = this.splitIntoSentences(text);
    let currentPos = 0;
    let targetSentenceIndex = 0;

    // Find sentence containing position
    for (let i = 0; i < sentences.length; i++) {
      currentPos += sentences[i].length + 1; // +1 for space
      if (currentPos >= position) {
        targetSentenceIndex = i;
        break;
      }
    }

    // Build context window around target sentence
    let contextTokens = 0;
    let startIndex = targetSentenceIndex;
    let endIndex = targetSentenceIndex;

    // Expand window
    while (contextTokens < windowSize && (startIndex > 0 || endIndex < sentences.length - 1)) {
      const canExpandLeft = startIndex > 0;
      const canExpandRight = endIndex < sentences.length - 1;

      if (canExpandLeft && (!canExpandRight || startIndex - targetSentenceIndex <= endIndex - targetSentenceIndex)) {
        startIndex--;
        contextTokens = this.tokenCounter.count(
          sentences.slice(startIndex, endIndex + 1).join(' '),
          model
        ).tokens;
      } else if (canExpandRight) {
        endIndex++;
        contextTokens = this.tokenCounter.count(
          sentences.slice(startIndex, endIndex + 1).join(' '),
          model
        ).tokens;
      }
    }

    return sentences.slice(startIndex, endIndex + 1).join(' ');
  }
}