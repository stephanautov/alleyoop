// src/components/llm/provider-selector.tsx
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Brain,
  Zap,
  DollarSign,
  FileText,
  Search,
  Eye,
  Code,
  Globe,
  Sparkles,
} from "lucide-react";
import {
  LLMService,
  type ProviderName,
  type ModelInfo,
} from "~/server/services/llm";
import { cn } from "~/lib/utils";

interface ProviderSelectorProps {
  value?: { provider: ProviderName; model: string };
  onChange: (value: { provider: ProviderName; model: string }) => void;
  showCosts?: boolean;
  showCapabilities?: boolean;
  documentType?: string;
}

const providerInfo: Record<
  ProviderName,
  {
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    strengths: string[];
  }
> = {
  openai: {
    name: "OpenAI",
    description: "Industry-leading models with broad capabilities",
    icon: <Brain className="h-5 w-5" />,
    color: "text-green-600",
    strengths: ["General purpose", "Code generation", "Function calling"],
  },
  anthropic: {
    name: "Anthropic",
    description: "Excellent for long documents and nuanced writing",
    icon: <FileText className="h-5 w-5" />,
    color: "text-purple-600",
    strengths: ["Long context", "Writing quality", "Safety"],
  },
  gemini: {
    name: "Google Gemini",
    description: "Massive context window and multimodal capabilities",
    icon: <Sparkles className="h-5 w-5" />,
    color: "text-blue-600",
    strengths: ["Ultra-long context", "Vision", "Fast inference"],
  },
  perplexity: {
    name: "Perplexity",
    description: "Real-time web search with citations",
    icon: <Search className="h-5 w-5" />,
    color: "text-orange-600",
    strengths: ["Web search", "Citations", "Current information"],
  },
  llama: {
    name: "Llama",
    description: "Open-source models with flexible deployment",
    icon: <Globe className="h-5 w-5" />,
    color: "text-indigo-600",
    strengths: ["Open source", "Cost effective", "Privacy"],
  },
};

const capabilityIcons: Record<string, React.ReactNode> = {
  chat: <Brain className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  vision: <Eye className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  fast: <Zap className="h-4 w-4" />,
  "long-context": <FileText className="h-4 w-4" />,
  "ultra-long-context": <FileText className="h-4 w-4 text-purple-600" />,
};

export function ProviderSelector({
  value,
  onChange,
  showCosts = true,
  showCapabilities = true,
  documentType,
}: ProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(
    value?.provider || "openai",
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    value?.model || "gpt-4-turbo",
  );
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  useEffect(() => {
    const availableModels = LLMService.getModelsForProvider(selectedProvider);
    setModels(availableModels);

    // Select default/recommended model when provider changes
    if (!value || selectedProvider !== value.provider) {
      const recommendedModel = availableModels.find((m) => m.recommended);
      if (recommendedModel) {
        setSelectedModel(recommendedModel.id);
        onChange({ provider: selectedProvider, model: recommendedModel.id });
      }
    }
  }, [selectedProvider]);

  useEffect(() => {
    // Calculate estimated cost based on document type
    if (showCosts && selectedModel) {
      const model = models.find((m) => m.id === selectedModel);
      if (model) {
        // Rough token estimates by document type
        const tokenEstimates: Record<string, number> = {
          BIOGRAPHY: 5000,
          CASE_SUMMARY: 3000,
          BUSINESS_PLAN: 10000,
          GRANT_PROPOSAL: 8000,
          MEDICAL_REPORT: 4000,
        };

        const estimatedTokens = tokenEstimates[documentType || ""] || 5000;
        const inputTokens = estimatedTokens * 0.3; // 30% input
        const outputTokens = estimatedTokens * 0.7; // 70% output

        const cost =
          (inputTokens * model.costPer1kTokens.input) / 1000 +
          (outputTokens * model.costPer1kTokens.output) / 1000;

        setEstimatedCost(cost);
      }
    }
  }, [selectedModel, documentType, models, showCosts]);

  const handleProviderChange = (provider: ProviderName) => {
    setSelectedProvider(provider);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    onChange({ provider: selectedProvider, model: modelId });
  };

  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  return (
    <div className="space-y-4">
      <Tabs
        value={selectedProvider}
        onValueChange={(v) => handleProviderChange(v as ProviderName)}
      >
        <TabsList className="grid w-full grid-cols-5">
          {Object.entries(providerInfo).map(([key, info]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex items-center gap-2"
            >
              <span className={cn(info.color)}>{info.icon}</span>
              <span className="hidden sm:inline">{info.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(providerInfo).map(([key, info]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={cn(info.color)}>{info.icon}</span>
                  {info.name}
                </CardTitle>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {info.strengths.map((strength) => (
                    <Badge key={strength} variant="secondary">
                      {strength}
                    </Badge>
                  ))}
                </div>

                <div>
                  <Label htmlFor="model-select">Model</Label>
                  <Select
                    value={selectedModel}
                    onValueChange={handleModelChange}
                  >
                    <SelectTrigger id="model-select">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex w-full items-center justify-between">
                            <span>{model.name}</span>
                            {model.recommended && (
                              <Badge variant="default" className="ml-2">
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedModelInfo && (
                  <>
                    {showCapabilities && (
                      <div>
                        <Label>Capabilities</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedModelInfo.capabilities.map((capability) => (
                            <Badge
                              key={capability}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {capabilityIcons[capability]}
                              {capability}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Context Window</Label>
                        <p className="text-muted-foreground text-sm">
                          {selectedModelInfo.contextWindow.toLocaleString()}{" "}
                          tokens
                        </p>
                      </div>
                      <div>
                        <Label>Max Output</Label>
                        <p className="text-muted-foreground text-sm">
                          {selectedModelInfo.maxOutput.toLocaleString()} tokens
                        </p>
                      </div>
                    </div>

                    {showCosts && (
                      <div className="space-y-2">
                        <Label>Pricing</Label>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Input:
                            </span>
                            <span className="ml-2">
                              ${selectedModelInfo.costPer1kTokens.input}/1k
                              tokens
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Output:
                            </span>
                            <span className="ml-2">
                              ${selectedModelInfo.costPer1kTokens.output}/1k
                              tokens
                            </span>
                          </div>
                        </div>

                        {documentType && (
                          <Alert>
                            <DollarSign className="h-4 w-4" />
                            <AlertDescription>
                              Estimated cost for this document:{" "}
                              <strong>${estimatedCost.toFixed(3)}</strong>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
