// src/types/preferences.ts
import { DocumentType } from "@prisma/client";
import { type ProviderName } from "../server/services/llm/index";

export interface UserPreferences {
    id: string;
    userId: string;
    defaultProvider: ProviderName;
    providerModels: Record<DocumentType, { provider: ProviderName; model: string }>;
    temperature: number;
    maxTokensOverride: number | null;
    systemPromptStyle: 'professional' | 'creative' | 'technical';
    monthlyCostLimit: number | null;
    costAlertEmail: boolean;
    costAlertWebhook: string | null;
    preferSpeed: boolean;
    allowFallback: boolean;
    cacheEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}