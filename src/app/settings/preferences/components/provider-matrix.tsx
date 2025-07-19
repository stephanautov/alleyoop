// src/app/settings/preferences/components/provider-matrix.tsx

import { DocumentType } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { DOCUMENT_CONFIGS } from "~/config/documents";
import { LLMService, type ProviderName } from "~/server/services/llm";

interface ProviderMatrixProps {
    preferences: any;
    availableProviders: Record<string, boolean> | undefined;
    onUpdate: (providerModels: Record<string, { provider: ProviderName; model: string }>) => void;
}

export function ProviderMatrix({ preferences, availableProviders, onUpdate }: ProviderMatrixProps) {
    const providerModels = preferences?.providerModels || {};

    const handleChange = (documentType: DocumentType, provider: ProviderName, model: string) => {
        const updated = {
            ...providerModels,
            [documentType]: { provider, model },
        };
        onUpdate(updated);
    };

    return (
        <div className="space-y-4">
            <div className="mb-4">
                <Label>Default Provider</Label>
                <Select
                    value={preferences?.defaultProvider}
                    onValueChange={(value) => onUpdate({ ...providerModels })}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select default provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(availableProviders || {}).map(([provider, available]) => (
                            <SelectItem key={provider} value={provider} disabled={!available}>
                                <div className="flex items-center gap-2">
                                    <span>{provider}</span>
                                    {!available && <Badge variant="secondary">No API Key</Badge>}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label>Document Type Preferences</Label>
                {Object.entries(DOCUMENT_CONFIGS).map(([type, config]) => {
                    if (!config.enabled) return null;

                    const current = providerModels[type] || {
                        provider: preferences?.defaultProvider || 'openai',
                        model: null,
                    };

                    const models = LLMService.MODELS.filter(m => m.provider === current.provider);

                    return (
                        <Card key={type} className="p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label className="text-sm">{config.name}</Label>
                                    <p className="text-xs text-muted-foreground">{config.description}</p>
                                </div>

                                <div className="space-y-2">
                                    <Select
                                        value={current.provider}
                                        onValueChange={(provider) => {
                                            const firstModel = LLMService.MODELS.find(m => m.provider === provider);
                                            handleChange(type as DocumentType, provider as ProviderName, firstModel?.id || '');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(availableProviders || {}).map(([provider, available]) => (
                                                <SelectItem key={provider} value={provider} disabled={!available}>
                                                    {provider}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={current.model || models[0]?.id}
                                        onValueChange={(model) => handleChange(type as DocumentType, current.provider, model)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {models.map((model) => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span>{model.name}</span>
                                                        {model.recommended && (
                                                            <Badge variant="secondary" className="ml-2">Recommended</Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}