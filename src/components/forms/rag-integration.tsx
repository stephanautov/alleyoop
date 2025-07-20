// src/components/forms/rag-integration.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
    Brain,
    Sparkles,
    Database,
    Search,
    ChevronDown,
    Info,
    FileText,
    CheckCircle,
    AlertCircle,
    Loader2,
    Eye,
    EyeOff
} from "lucide-react";
import { api } from "~/trpc/react";
import { KnowledgeManagement } from "~/app/knowledge/page";
import { FormGenerator } from "~/components/forms/form-generator";
import { cn } from "~/lib/utils";
import { DocumentType } from "@prisma/client";

interface RAGIntegrationProps {
    documentType: DocumentType;
    formData: any;
    onFormDataChange: (data: any) => void;
    onRAGConfigChange: (config: RAGConfig) => void;
    schema: any;
    fieldConfig?: any;
    className?: string;
}

interface RAGConfig {
    ragEnabled: boolean;
    knowledgeSourceIds: string[];
    autoSelect: boolean;
    maxSources?: number;
    contextPreview?: boolean;
}

interface ContextPreview {
    sourceId: string;
    sourceName: string;
    relevantChunks: Array<{
        content: string;
        similarity: number;
        metadata?: any;
    }>;
}

export function DocumentFormWithRAG({
    documentType,
    formData,
    onFormDataChange,
    onRAGConfigChange,
    schema,
    fieldConfig,
    className
}: RAGIntegrationProps) {
    const [ragConfig, setRAGConfig] = useState<RAGConfig>({
        ragEnabled: false,
        knowledgeSourceIds: [],
        autoSelect: true,
        maxSources: 3,
        contextPreview: true
    });

    const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
    const [contextPreviews, setContextPreviews] = useState<ContextPreview[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Get available knowledge sources
    const { data: sources } = api.knowledge.list.useQuery({
        limit: 50,
    });

    // Preview mutation
    const previewMutation = api.knowledge.preview.useMutation({
        onSuccess: (data) => {
            setContextPreviews(data.previews);
            setIsLoadingPreview(false);
        },
        onError: () => {
            setIsLoadingPreview(false);
        }
    });

    // Update parent when config changes
    useEffect(() => {
        onRAGConfigChange(ragConfig);
    }, [ragConfig, onRAGConfigChange]);

    // Auto-preview when form data changes (debounced)
    useEffect(() => {
        if (!ragConfig.ragEnabled || !ragConfig.contextPreview) return;

        const timer = setTimeout(() => {
            handlePreview();
        }, 1000);

        return () => clearTimeout(timer);
    }, [formData, ragConfig.ragEnabled, ragConfig.knowledgeSourceIds]);

    const handleRAGToggle = (enabled: boolean) => {
        setRAGConfig(prev => ({ ...prev, ragEnabled: enabled }));
        if (enabled && sources?.sources.length === 0) {
            setShowKnowledgeSelector(true);
        }
    };

    const handleSourceSelection = (sourceIds: string[]) => {
        setRAGConfig(prev => ({ ...prev, knowledgeSourceIds: sourceIds }));
    };

    const handlePreview = async () => {
        if (!formData || Object.keys(formData).length === 0) return;

        setIsLoadingPreview(true);
        await previewMutation.mutateAsync({
            documentType,
            formData,
            sourceIds: ragConfig.autoSelect ? undefined : ragConfig.knowledgeSourceIds,
            maxSources: ragConfig.maxSources
        });
    };

    const availableSourceCount = sources?.sources.filter(s => s.status === 'COMPLETED').length || 0;

    return (
        <div className={cn("space-y-6", className)}>
            {/* Main Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Document Information</CardTitle>
                    <CardDescription>
                        Fill in the required information for your {documentType.toLowerCase().replace('_', ' ')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FormGenerator
                        schema={schema}
                        onSubmit={onFormDataChange}
                        defaultValues={formData}
                        fieldConfig={fieldConfig}
                    />
                </CardContent>
            </Card>

            {/* RAG Enhancement Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5" />
                                Knowledge Enhancement
                            </CardTitle>
                            <CardDescription>
                                Enhance your document with information from your knowledge base
                            </CardDescription>
                        </div>
                        <Switch
                            checked={ragConfig.ragEnabled}
                            onCheckedChange={handleRAGToggle}
                        />
                    </div>
                </CardHeader>

                {ragConfig.ragEnabled && (
                    <CardContent className="space-y-4">
                        {/* No sources warning */}
                        {availableSourceCount === 0 ? (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    You don't have any knowledge sources yet. Upload documents to enhance your content.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                {/* Source Selection Mode */}
                                <div className="space-y-3">
                                    <Label>Source Selection</Label>
                                    <RadioGroup
                                        value={ragConfig.autoSelect ? "auto" : "manual"}
                                        onValueChange={(value) =>
                                            setRAGConfig(prev => ({ ...prev, autoSelect: value === "auto" }))
                                        }
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="auto" id="auto" />
                                            <Label htmlFor="auto" className="flex items-center gap-2 cursor-pointer">
                                                <Sparkles className="h-4 w-4" />
                                                Auto-select best sources
                                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="manual" id="manual" />
                                            <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                                                <Database className="h-4 w-4" />
                                                Choose specific sources
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {/* Manual Source Selection */}
                                {!ragConfig.autoSelect && (
                                    <Collapsible open={showKnowledgeSelector} onOpenChange={setShowKnowledgeSelector}>
                                        <CollapsibleTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                <span className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4" />
                                                    Select Knowledge Sources
                                                    {ragConfig.knowledgeSourceIds.length > 0 && (
                                                        <Badge variant="secondary">
                                                            {ragConfig.knowledgeSourceIds.length} selected
                                                        </Badge>
                                                    )}
                                                </span>
                                                <ChevronDown className={cn(
                                                    "h-4 w-4 transition-transform",
                                                    showKnowledgeSelector && "rotate-180"
                                                )} />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-4">
                                            <div className="border rounded-lg p-4">
                                                <KnowledgeManagement
                                                    embedded={true}
                                                    selectedSources={ragConfig.knowledgeSourceIds}
                                                    onSourceSelect={handleSourceSelection}
                                                />
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}

                                {/* Context Preview */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2">
                                            <Eye className="h-4 w-4" />
                                            Context Preview
                                        </Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowPreview(!showPreview)}
                                        >
                                            {showPreview ? (
                                                <>
                                                    <EyeOff className="h-4 w-4 mr-2" />
                                                    Hide
                                                </>
                                            ) : (
                                                <>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Show
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {showPreview && (
                                        <div className="border rounded-lg p-4 bg-muted/50">
                                            {isLoadingPreview ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : contextPreviews.length > 0 ? (
                                                <Tabs defaultValue={contextPreviews[0].sourceId} className="w-full">
                                                    <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${contextPreviews.length}, 1fr)` }}>
                                                        {contextPreviews.map((preview) => (
                                                            <TabsTrigger key={preview.sourceId} value={preview.sourceId} className="text-xs">
                                                                {preview.sourceName}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                    {contextPreviews.map((preview) => (
                                                        <TabsContent key={preview.sourceId} value={preview.sourceId}>
                                                            <ScrollArea className="h-[200px]">
                                                                <div className="space-y-3">
                                                                    {preview.relevantChunks.map((chunk, index) => (
                                                                        <div key={index} className="space-y-1">
                                                                            <div className="flex items-center justify-between">
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {Math.round(chunk.similarity * 100)}% relevant
                                                                                </Badge>
                                                                                {chunk.metadata?.page && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        Page {chunk.metadata.page}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                {chunk.content}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </ScrollArea>
                                                        </TabsContent>
                                                    ))}
                                                </Tabs>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                                    <p className="text-sm text-muted-foreground">
                                                        Fill in the form above to see relevant context
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Info box */}
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                        Your document will be enhanced with relevant information from {ragConfig.autoSelect ? 'automatically selected' : 'your chosen'} knowledge sources.
                                        The AI will seamlessly integrate this context while maintaining your requested style and format.
                                    </AlertDescription>
                                </Alert>
                            </>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}