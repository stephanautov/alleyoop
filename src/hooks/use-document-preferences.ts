// src/hooks/use-document-preferences.ts

import { useEffect, useState } from 'react';
import { api } from '~/trpc/react';
import type { DocumentType } from '@prisma/client';
import type { ProviderName } from '~/server/services/llm';

interface DocumentPreferences {
    provider: ProviderName;
    model: string | null;
    settings: {
        temperature: number;
        maxTokens: number | null;
        systemPromptStyle: string;
        preferSpeed: boolean;
        cacheEnabled: boolean;
    };
}

export function useDocumentPreferences(documentType: DocumentType | null) {
    const { data: userPreferences, isLoading: prefsLoading } = api.preferences.get.useQuery();
    const { data: documentPreferences, isLoading: docPrefsLoading } = api.preferences.getProviderForDocument.useQuery(
        { documentType: documentType! },
        { enabled: !!documentType }
    );
    const { data: costLimit } = api.preferences.checkCostLimit.useQuery();

    const [preferences, setPreferences] = useState<DocumentPreferences | null>(null);
    const [canGenerate, setCanGenerate] = useState(true);

    useEffect(() => {
        if (!prefsLoading && !docPrefsLoading) {
            const prefs = documentType ? documentPreferences : null;

            setPreferences({
                provider: prefs?.provider || userPreferences?.defaultProvider || 'openai',
                model: prefs?.model || null,
                settings: {
                    temperature: prefs?.settings?.temperature || userPreferences?.temperature || 0.7,
                    maxTokens: prefs?.settings?.maxTokens || userPreferences?.maxTokensOverride || null,
                    systemPromptStyle: prefs?.settings?.systemPromptStyle || userPreferences?.systemPromptStyle || 'professional',
                    preferSpeed: prefs?.settings?.preferSpeed || userPreferences?.preferSpeed || false,
                    cacheEnabled: prefs?.settings?.cacheEnabled || userPreferences?.cacheEnabled || true,
                },
            });
        }
    }, [userPreferences, documentPreferences, documentType, prefsLoading, docPrefsLoading]);

    useEffect(() => {
        // Check if user can generate based on cost limit
        if (costLimit && !costLimit.withinLimit) {
            setCanGenerate(false);
        }
    }, [costLimit]);

    return {
        preferences,
        isLoading: prefsLoading || docPrefsLoading,
        canGenerate,
        costStatus: costLimit,
    };
}