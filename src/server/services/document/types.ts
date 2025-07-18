// src/server/services/document/types.ts

export type DocumentProviderName = 'openai' | 'anthropic' | 'gemini' | 'perplexity' | 'llama';
export type ToneType = 'professional' | 'creative' | 'technical' | 'conversational' | 'academic';

export interface ProgressEventData {
    progress: number;
    message?: string;
    phase?: string;
    stage?: string;
    documentId?: string;
    estimatedTimeRemaining?: number;
    currentSection?: string;
    metadata?: Record<string, any>;
}

export interface SectionData {
    id: string;
    title: string;
    content?: string;
    order: number;
}

export interface GenerateDocumentParams {
    type: string;
    input: any;
    userId: string;
    documentId: string;
    provider?: DocumentProviderName;
}

export interface GeneratedDocument {
    outline: string;
    sections: Record<string, string>;
    content: string;
    metadata?: any;
}