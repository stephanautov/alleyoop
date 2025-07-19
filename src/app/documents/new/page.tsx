//src/app/documents/new/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FormGenerator } from "~/components/forms/form-generator";
import { ProviderSelector } from "~/components/llm/provider-selector";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  FileText,
  ArrowLeft,
  Sparkles,
  Clock,
  DollarSign,
  AlertCircle,
  Settings,
  User,
  Scale,
  Briefcase,
  FileHeart,
} from "lucide-react";
import { DocumentType } from "@prisma/client";
import {
  getDocumentSchema,
  getDocumentConfig,
  estimateTokenUsage,
  estimateCost,
  biographySchema,
  caseSummarySchema,
  businessPlanSchema,
  medicalReportSchema,
  grantProposalSchema,
} from "~/config/documents";
import Link from "next/link";
import type { ProviderName } from "~/server/services/llm";

export default function NewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") as DocumentType | null;

  const [selectedType, setSelectedType] = useState<DocumentType | null>(
    initialType && Object.values(DocumentType).includes(initialType)
      ? initialType
      : null,
  );

  // Provider selection state
  const [selectedProvider, setSelectedProvider] = useState<ProviderName | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { data: availableTypes, isLoading } =
    api.document.getAvailableTypes.useQuery();

  // User preferences queries
  const { data: userPreferences } = api.preferences.get.useQuery();
  const { data: documentPreferences } = api.preferences.getProviderForDocument.useQuery(
    { documentType: selectedType! },
    { enabled: !!selectedType }
  );
  const { data: costStatus } = api.preferences.checkCostLimit.useQuery();

  // Set default provider/model when preferences load or document type changes
  useEffect(() => {
    if (documentPreferences) {
      setSelectedProvider(documentPreferences.provider);
      setSelectedModel(documentPreferences.model);
    } else if (userPreferences) {
      setSelectedProvider(userPreferences.defaultProvider);
      setSelectedModel(null);
    }
  }, [documentPreferences, userPreferences]);

  const createDocument = api.document.create.useMutation({
    onSuccess: (document) => {
      toast.success("Document created successfully!");
      router.push(`/documents/${document.id}`);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create document");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="bg-muted h-8 w-48 rounded"></div>
          <div className="bg-muted h-64 rounded"></div>
        </div>
      </div>
    );
  }

  const handleTypeSelect = (type: DocumentType) => {
    setSelectedType(type);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set("type", type);
    window.history.pushState({}, "", url);
  };

  const handleSubmit = async (data: any) => {
    if (!selectedType || !selectedProvider) {
      toast.error("Please select a provider");
      return;
    }

    // Check cost limit
    if (costStatus && !costStatus.withinLimit) {
      toast.error(`Monthly cost limit exceeded. Current: $${costStatus.currentCost?.toFixed(2)} / $${costStatus.limit?.toFixed(2)}`);
      return;
    }

    await createDocument.mutateAsync({
      type: selectedType,
      title: data.title,
      input: data,
      provider: selectedProvider,
      model: selectedModel || undefined,
      temperature: documentPreferences?.settings?.temperature,
      maxTokens: documentPreferences?.settings?.maxTokens || undefined,
      useCache: documentPreferences?.settings?.cacheEnabled,
    });
  };

  const getSchemaForType = (type: DocumentType) => {
    switch (type) {
      case DocumentType.BIOGRAPHY:
        return biographySchema;
      case DocumentType.CASE_SUMMARY:
        return caseSummarySchema;
      case DocumentType.BUSINESS_PLAN:
        return businessPlanSchema;
      case DocumentType.MEDICAL_REPORT:
        return medicalReportSchema;
      case DocumentType.GRANT_PROPOSAL:
        return grantProposalSchema;
      default:
        return biographySchema;
    }
  };

  // Check if user can generate documents
  const canGenerate = !costStatus || costStatus.withinLimit;

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <Link href="/settings/preferences">
          <Button variant="ghost" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Create New Document
        </h1>
        <p className="text-muted-foreground">
          Choose a document type and provide the necessary information
        </p>
      </div>

      {/* Cost limit warning */}
      {costStatus && !costStatus.withinLimit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached your monthly cost limit (${costStatus.limit?.toFixed(2)}).
            Current usage: ${costStatus.currentCost?.toFixed(2)}.
            <Link href="/settings/preferences" className="underline ml-1">
              Update your limit
            </Link> to continue generating documents.
          </AlertDescription>
        </Alert>
      )}

      {!selectedType ? (
        // Document Type Selection
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableTypes?.map((type) => {
            const config = getDocumentConfig(type.type);
            const Icon = getIconComponent(type.icon);
            return (
              <Card
                key={type.type}
                className="hover:border-primary cursor-pointer transition-all hover:shadow-lg"
                onClick={() => handleTypeSelect(type.type)}
              >
                <CardHeader>
                  <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Icon className="text-primary h-6 w-6" />
                  </div>
                  <CardTitle>{type.name}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {type.exportFormats.map((format) => (
                      <Badge
                        key={format}
                        variant="secondary"
                        className="text-xs"
                      >
                        {format.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Document Creation Form
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {getDocumentConfig(selectedType).name}
                    </CardTitle>
                    <CardDescription>
                      Fill out the form below to generate your document
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedType(null)}
                  >
                    Change Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">AI Provider</h3>
                  <ProviderSelector
                    value={{
                      provider: selectedProvider || userPreferences?.defaultProvider || 'openai',
                      model: selectedModel || null
                    }}
                    onChange={({ provider, model }) => {
                      setSelectedProvider(provider);
                      setSelectedModel(model);
                    }}
                    documentType={selectedType}
                    showCosts={true}
                    showCapabilities={true}
                  />
                  {documentPreferences && (
                    <p className="text-xs text-muted-foreground">
                      Using your saved preference for {getDocumentConfig(selectedType).name}
                    </p>
                  )}
                </div>

                {/* Document Form */}
                <FormGenerator
                  schema={getSchemaForType(selectedType)}
                  onSubmit={handleSubmit}
                  isSubmitting={createDocument.isPending}
                  submitText="Generate Document"
                  fieldConfig={getFieldConfig(selectedType)}
                  disabled={!canGenerate}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Model Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Generation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="text-primary h-4 w-4" />
                  <span>
                    {selectedProvider && selectedModel
                      ? `${selectedProvider} - ${selectedModel}`
                      : 'Select a provider'
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span>~2-5 minutes generation time</span>
                </div>
                {documentPreferences?.settings && (
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                    <div>Temperature: {documentPreferences.settings.temperature}</div>
                    {documentPreferences.settings.preferSpeed && (
                      <div>Speed optimized</div>
                    )}
                    {documentPreferences.settings.cacheEnabled && (
                      <div>Caching enabled</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Estimate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimated Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="medium" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="short">Short</TabsTrigger>
                    <TabsTrigger value="medium">Medium</TabsTrigger>
                    <TabsTrigger value="long">Long</TabsTrigger>
                  </TabsList>
                  {["short", "medium", "long"].map((length) => {
                    const tokens = estimateTokenUsage(
                      selectedType,
                      length as "short" | "medium" | "long",
                    );
                    const cost = estimateCost(tokens);
                    return (
                      <TabsContent
                        key={length}
                        value={length}
                        className="space-y-2"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tokens:</span>
                          <span>{tokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {cost.toFixed(2)}
                          </span>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
                {costStatus && costStatus.percentage > 80 && (
                  <Alert className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      You've used {costStatus.percentage}% of your monthly limit
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Tips for better results:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Provide specific, detailed information</li>
                  <li>• Choose the appropriate output length</li>
                  <li>• Review and edit the generated content</li>
                  <li>• Select the best AI model for your needs</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
}

// Field configurations for different document types
function getFieldConfig(type: DocumentType) {
  const commonConfig = {
    title: {
      placeholder: "Enter a descriptive title for your document",
      description: "This will be the main title of your generated document",
    },
    outputLength: {
      label: "Document Length",
      description: "Choose how detailed you want the document to be",
    },
  };

  const typeSpecificConfig: Record<DocumentType, any> = {
    [DocumentType.BIOGRAPHY]: {
      ...commonConfig,
      subject: {
        label: "Subject Information",
        description: "Details about the person this biography is about",
      },
      purpose: {
        label: "Biography Purpose",
        description: "What is the intended use of this biography?",
      },
      tone: {
        label: "Writing Tone",
        description: "The style and tone for the biography",
      },
      focusAreas: {
        label: "Areas to Focus On",
        description: "Select the sections you want to include",
        multiple: true,
      },
      additionalInfo: {
        label: "Additional Information",
        placeholder:
          "Any specific details, achievements, or context you want included",
        type: "textarea",
        rows: 4,
      },
    },
    [DocumentType.CASE_SUMMARY]: {
      ...commonConfig,
      caseInfo: {
        label: "Case Information",
        description: "Basic information about the legal case",
      },
      parties: {
        label: "Parties Involved",
        description: "The plaintiff and defendant in the case",
      },
      legalIssues: {
        label: "Legal Issues",
        description: "The main legal questions addressed in the case",
        placeholder: "Add a legal issue and press Enter",
      },
      facts: {
        label: "Case Facts (Optional)",
        placeholder: "Provide any specific facts about the case",
        type: "textarea",
        rows: 4,
      },
      includeAnalysis: {
        label: "Include Legal Analysis",
        description: "Add analysis of the legal reasoning and implications",
      },
    },
    [DocumentType.BUSINESS_PLAN]: {
      ...commonConfig,
      business: {
        label: "Business Information",
        description: "Basic details about your business",
      },
      sections: {
        label: "Sections to Include",
        description: "Choose which sections to include in your business plan",
        multiple: true,
      },
      targetAudience: {
        label: "Target Audience",
        description: "Who will be reading this business plan?",
      },
      fundingAmount: {
        label: "Funding Amount (Optional)",
        placeholder: "e.g., $500,000",
        description: "If seeking funding, specify the amount",
      },
      financialYears: {
        label: "Financial Projection Years",
        description: "Number of years for financial projections",
      },
    },
    [DocumentType.MEDICAL_REPORT]: {
      ...commonConfig,
      patient: {
        label: "Patient Information",
        description: "Use identifiers only, no real patient names",
      },
      reportType: {
        label: "Report Type",
        description: "The type of medical report to generate",
      },
      clinicalInfo: {
        label: "Clinical Information",
        description: "Key medical details for the report",
      },
      findings: {
        label: "Clinical Findings (Optional)",
        placeholder: "Describe examination findings, test results, etc.",
        type: "textarea",
        rows: 4,
      },
      recommendations: {
        label: "Recommendations (Optional)",
        placeholder: "Treatment recommendations or follow-up plans",
        type: "textarea",
        rows: 3,
      },
      includeDisclaimer: {
        label: "Include Medical Disclaimer",
        description: "Add a disclaimer that this is AI-generated content",
      },
    },
    [DocumentType.GRANT_PROPOSAL]: {
      ...commonConfig,
      organization: {
        label: "Organization Information",
        description: "Details about the organization applying for the grant",
      },
      grant: {
        label: "Grant Information",
        description: "Details about the grant opportunity",
      },
      project: {
        label: "Project Information",
        description: "Information about the proposed project",
      },
      sections: {
        label: "Sections to Include",
        description: "Choose which sections to include in your proposal",
        multiple: true,
      },
      focusArea: {
        label: "Project Focus Area",
        placeholder: "e.g., Education, Healthcare, Environment",
        description: "The main area or field of your project",
      },
    },
  };

  return typeSpecificConfig[type] || commonConfig;
}

// Helper function to get icon component
function getIconComponent(iconName: string) {
  const icons: Record<string, any> = {
    User: User,
    Scale: Scale,
    Briefcase: Briefcase,
    FileHeart: FileHeart,
    FileText: FileText,
  };
  return icons[iconName] || FileText;
}