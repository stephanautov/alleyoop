// src/app/admin/generators/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  Code2,
  Component,
  FileText,
  TestTube,
  Rocket,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Save,
  Undo2,
  AlertCircle,
  History,
  FileCode,
  Sparkles,
  Package,
  Zap,
  Clock,
  TrendingUp,
  Terminal,
  Download,
  Upload,
  Users,
  BarChart,
  X
} from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSession } from "next-auth/react";
import { cn } from "~/lib/utils";

// Import components
import { BulkGenerateDialog } from "./components/bulk-generate-dialog";
import { MetricsDashboard } from "./components/metrics-dashboard";
import { RateLimitIndicator } from "./components/rate-limit-indicator";
import { ValidationDialog } from "./components/validation-dialog";

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  generator: string;
  config: any;
}

interface StreamMessage {
  type: 'output' | 'log' | 'error' | 'complete' | 'file' | 'progress';
  data: any;
}

interface GeneratorTab {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const generatorTabs: GeneratorTab[] = [
  {
    id: "router",
    name: "tRPC Router",
    icon: Code2,
    description: "Generate a new tRPC router with CRUD operations"
  },
  {
    id: "component",
    name: "React Component",
    icon: Component,
    description: "Create a new React component with TypeScript"
  },
  {
    id: "document",
    name: "Document Type",
    icon: FileText,
    description: "Add a new document type with schemas and prompts"
  },
  {
    id: "feature",
    name: "Full Feature",
    icon: Rocket,
    description: "Generate a complete feature with UI, API, and database"
  },
  {
    id: "test",
    name: "Test Suite",
    icon: TestTube,
    description: "Create test files for existing code"
  }
];

export default function GeneratorsPage() {
  const { data: session } = useSession();
  const [selectedGenerator, setSelectedGenerator] = useState("router");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<GeneratedFile[]>([]);
  const [streamOutput, setStreamOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Generator-specific state
  const [routerName, setRouterName] = useState("");
  const [routerModel, setRouterModel] = useState("");
  const [includeCrud, setIncludeCrud] = useState(true);

  const [componentName, setComponentName] = useState("");
  const [componentType, setComponentType] = useState("client");
  const [includeTests, setIncludeTests] = useState(false);

  const [documentTypeName, setDocumentTypeName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");

  const [featureName, setFeatureName] = useState("");
  const [featureModules, setFeatureModules] = useState({
    ui: true,
    api: true,
    db: true,
    tests: false
  });

  const [testTarget, setTestTarget] = useState("");
  const [testType, setTestType] = useState("unit");

  // API hooks
  const { data: templates } = api.generators.listTemplates.useQuery();
  const { data: history } = api.generators.getHistory.useQuery(undefined, {
    enabled: showHistory
  });
  const { data: metrics } = api.generators.getMetrics.useQuery(undefined, {
    enabled: showMetrics
  });

  const generateMutation = api.generators.generateRouterWithValidation.useMutation({
    onSuccess: (data: any) => {
      if (data.needsConfirmation) {
        setValidationResults(data.validation);
        setShowValidation(true);
      } else {
        toast.success("Generation completed successfully!");
        resetForm();
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
      setIsGenerating(false);
    }
  });

  const undoMutation = api.generators.undoGeneration.useMutation({
    onSuccess: () => {
      toast.success("Generation undone successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const saveTemplateMutation = api.generators.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template saved successfully!");
    }
  });

  // Subscribe to streaming updates
  api.generators.streamGeneration.useSubscription(
    { sessionId: generateMutation.data?.sessionId || "" },
    {
      enabled: !!generateMutation.data?.sessionId && isGenerating,
      onData: (message: StreamMessage) => {
        switch (message.type) {
          case 'output':
          case 'log':
            setStreamOutput(prev => [...prev, message.data]);
            break;
          case 'file':
            setPreviewFiles(prev => [...prev, message.data]);
            break;
          case 'progress':
            setProgress(message.data);
            break;
          case 'complete':
            setIsGenerating(false);
            setProgress(100);
            break;
          case 'error':
            toast.error(message.data);
            setIsGenerating(false);
            break;
        }
      }
    }
  );

  const resetForm = () => {
    setRouterName("");
    setRouterModel("");
    setComponentName("");
    setDocumentTypeName("");
    setDocumentDescription("");
    setFeatureName("");
    setTestTarget("");
    setStreamOutput([]);
    setPreviewFiles([]);
    setProgress(0);
  };

  const handleGenerate = async (preview = false) => {
    setIsGenerating(true);
    setStreamOutput([]);
    setPreviewFiles([]);
    setShowOutput(true);
    setProgress(0);

    const baseConfig = {
      preview,
      force: false
    };

    try {
      switch (selectedGenerator) {
        case "router":
          await generateMutation.mutateAsync({
            type: "router",
            name: routerName,
            options: {
              ...baseConfig,
              model: routerModel,
              crud: includeCrud
            }
          });
          break;
        case "component":
          await generateMutation.mutateAsync({
            type: "component",
            name: componentName,
            options: {
              ...baseConfig,
              type: componentType,
              tests: includeTests
            }
          });
          break;
        case "document":
          await generateMutation.mutateAsync({
            type: "document",
            name: documentTypeName,
            options: {
              ...baseConfig,
              description: documentDescription
            }
          });
          break;
        case "feature":
          await generateMutation.mutateAsync({
            type: "feature",
            name: featureName,
            options: {
              ...baseConfig,
              modules: featureModules
            }
          });
          break;
        case "test":
          await generateMutation.mutateAsync({
            type: "test",
            name: testTarget,
            options: {
              ...baseConfig,
              type: testType
            }
          });
          break;
      }

      if (preview) {
        setShowPreview(true);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveTemplate = async () => {
    const config = {
      router: { name: routerName, model: routerModel, crud: includeCrud },
      component: { name: componentName, type: componentType, tests: includeTests },
      document: { name: documentTypeName, description: documentDescription },
      feature: { name: featureName, modules: featureModules },
      test: { target: testTarget, type: testType }
    }[selectedGenerator];

    const name = prompt("Template name:");
    const description = prompt("Template description (optional):");

    if (name) {
      await saveTemplateMutation.mutateAsync({
        name,
        description: description || undefined,
        generator: selectedGenerator,
        config
      });
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates?.find((t: Template) => t.id === templateId);
    if (!template) return;

    const config = template.config as any;
    switch (template.generator) {
      case "router":
        setRouterName(config.name || "");
        setRouterModel(config.model || "");
        setIncludeCrud(config.crud ?? true);
        break;
      case "component":
        setComponentName(config.name || "");
        setComponentType(config.type || "client");
        setIncludeTests(config.tests || false);
        break;
      // ... other generators
    }
  };

  // Check permissions
  const canGenerate = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "DEVELOPER";

  if (!canGenerate) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access code generators. Please contact an admin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Code Generators
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate boilerplate code with best practices built-in
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RateLimitIndicator />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetrics(!showMetrics)}
          >
            <BarChart className="h-4 w-4 mr-2" />
            Metrics
          </Button>
          <BulkGenerateDialog />
        </div>
      </div>

      {/* Metrics Dashboard */}
      {showMetrics && <MetricsDashboard metrics={metrics} />}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Generator Configuration</CardTitle>
              <CardDescription>
                Choose a generator and configure options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedGenerator} onValueChange={setSelectedGenerator}>
                <TabsList className="grid grid-cols-5 w-full">
                  {generatorTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex items-center gap-2"
                    >
                      <tab.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Router Generator */}
                <TabsContent value="router" className="space-y-4">
                  <div className="space-y-4">
                    {/* Template Selector */}
                    {templates && templates.filter((t: Template) => t.generator === "router").length > 0 && (
                      <div>
                        <Label>Load Template</Label>
                        <Select value={selectedTemplate} onValueChange={loadTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates
                              .filter((t: Template) => t.generator === "router")
                              .map((template: Template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="router-name">Router Name</Label>
                      <Input
                        id="router-name"
                        placeholder="e.g., user, product, analytics"
                        value={routerName}
                        onChange={(e) => setRouterName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Will create: src/server/api/routers/{routerName}.ts
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="router-model">Prisma Model (Optional)</Label>
                      <Input
                        id="router-model"
                        placeholder="e.g., User, Product"
                        value={routerModel}
                        onChange={(e) => setRouterModel(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave empty to use router name as model
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-crud"
                        checked={includeCrud}
                        onCheckedChange={(checked) => setIncludeCrud(!!checked)}
                      />
                      <Label
                        htmlFor="include-crud"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Include CRUD operations
                      </Label>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleGenerate(true)}
                        disabled={isGenerating || !routerName}
                        variant="outline"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !routerName}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Rocket className="h-4 w-4 mr-2" />
                        )}
                        Generate
                      </Button>
                      <Button
                        onClick={handleSaveTemplate}
                        variant="ghost"
                        size="icon"
                        disabled={!routerName}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Component Generator */}
                <TabsContent value="component" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="component-name">Component Name</Label>
                      <Input
                        id="component-name"
                        placeholder="e.g., UserProfile, Dashboard"
                        value={componentName}
                        onChange={(e) => setComponentName(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Component Type</Label>
                      <RadioGroup value={componentType} onValueChange={setComponentType}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="client" id="client" />
                          <Label htmlFor="client">Client Component</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="server" id="server" />
                          <Label htmlFor="server">Server Component</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-tests"
                        checked={includeTests}
                        onCheckedChange={(checked) => setIncludeTests(!!checked)}
                      />
                      <Label htmlFor="include-tests">Include test file</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleGenerate(true)}
                        disabled={isGenerating || !componentName}
                        variant="outline"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !componentName}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Component className="h-4 w-4 mr-2" />
                        )}
                        Generate
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Other generators follow similar pattern... */}
              </Tabs>
            </CardContent>
          </Card>

          {/* Output Console */}
          {showOutput && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Generation Output
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOutput(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {progress > 0 && progress < 100 && (
                  <Progress value={progress} className="mb-4" />
                )}
                <ScrollArea className="h-[200px] w-full rounded-md border p-4 font-mono text-sm">
                  {streamOutput.map((line, index) => (
                    <div key={index} className="mb-1">
                      {line}
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generation History</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {history?.map((item: any) => (
                    <div
                      key={item.sessionId}
                      className="mb-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">{item.generator}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => undoMutation.mutate({ sessionId: item.sessionId })}
                          disabled={item.undone}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          Undo
                        </Button>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview Generated Files</DialogTitle>
            <DialogDescription>
              Review the files that will be generated. Click Generate to create them.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {previewFiles.map((file, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    <span className="font-mono text-sm">{file.path}</span>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <SyntaxHighlighter
                      language={file.language}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        fontSize: '0.875rem',
                        maxHeight: '300px'
                      }}
                    >
                      {file.content}
                    </SyntaxHighlighter>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowPreview(false);
              handleGenerate(false);
            }}>
              <Rocket className="h-4 w-4 mr-2" />
              Generate Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Dialog */}
      <ValidationDialog
        open={showValidation}
        onOpenChange={setShowValidation}
        validation={validationResults}
        onConfirm={() => {
          setShowValidation(false);
          // Re-run with force flag
          handleGenerate(false);
        }}
      />
    </div >
  );
}


