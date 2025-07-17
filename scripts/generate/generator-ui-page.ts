// src/app/admin/generators/page.tsx

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
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
  XCircle
} from "lucide-react";

export default function GeneratorsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);

  // Router generator state
  const [routerName, setRouterName] = useState("");
  const [routerModel, setRouterModel] = useState("");
  const [includeCrud, setIncludeCrud] = useState(true);

  // Component generator state
  const [componentName, setComponentName] = useState("");
  const [componentType, setComponentType] = useState<"component" | "page" | "form">("component");
  const [componentDir, setComponentDir] = useState("");

  // Document type generator state
  const [docTypeName, setDocTypeName] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docSections, setDocSections] = useState<string[]>([]);
  const [docFormats, setDocFormats] = useState<string[]>(["pdf", "docx"]);

  // Test generator state
  const [testPath, setTestPath] = useState("");
  const [testType, setTestType] = useState<"unit" | "integration" | "e2e">("unit");

  // Feature generator state
  const [featureName, setFeatureName] = useState("");
  const [featureModel, setFeatureModel] = useState("");
  const [includeApi, setIncludeApi] = useState(true);
  const [includeUi, setIncludeUi] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);

  // API mutations
  const generateRouterMutation = api.generators.generateRouter.useMutation({
    onSuccess: (data) => {
      toast.success("Router generated successfully!");
      setGeneratedFiles(data.files);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate router");
    }
  });

  const generateComponentMutation = api.generators.generateComponent.useMutation({
    onSuccess: (data) => {
      toast.success("Component generated successfully!");
      setGeneratedFiles(data.files);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate component");
    }
  });

  const generateDocumentTypeMutation = api.generators.generateDocumentType.useMutation({
    onSuccess: (data) => {
      toast.success("Document type generated successfully!");
      setGeneratedFiles(data.files);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate document type");
    }
  });

  const generateTestMutation = api.generators.generateTest.useMutation({
    onSuccess: (data) => {
      toast.success("Tests generated successfully!");
      setGeneratedFiles(data.files);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate tests");
    }
  });

  const generateFeatureMutation = api.generators.generateFeature.useMutation({
    onSuccess: (data) => {
      toast.success("Feature generated successfully!");
      setGeneratedFiles(data.files);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate feature");
    }
  });

  // Form handlers
  const handleGenerateRouter = async () => {
    if (!routerName) {
      toast.error("Please enter a router name");
      return;
    }
    setIsGenerating(true);
    await generateRouterMutation.mutateAsync({
      name: routerName,
      model: routerModel || undefined,
      crud: includeCrud
    });
    setIsGenerating(false);
  };

  const handleGenerateComponent = async () => {
    if (!componentName) {
      toast.error("Please enter a component name");
      return;
    }
    setIsGenerating(true);
    await generateComponentMutation.mutateAsync({
      name: componentName,
      type: componentType,
      dir: componentDir || undefined
    });
    setIsGenerating(false);
  };

  const handleGenerateDocumentType = async () => {
    if (!docTypeName) {
      toast.error("Please enter a document type name");
      return;
    }
    setIsGenerating(true);
    await generateDocumentTypeMutation.mutateAsync({
      name: docTypeName,
      description: docDescription,
      sections: docSections,
      exportFormats: docFormats
    });
    setIsGenerating(false);
  };

  const handleGenerateTest = async () => {
    if (!testPath) {
      toast.error("Please enter a file path");
      return;
    }
    setIsGenerating(true);
    await generateTestMutation.mutateAsync({
      path: testPath,
      type: testType
    });
    setIsGenerating(false);
  };

  const handleGenerateFeature = async () => {
    if (!featureName) {
      toast.error("Please enter a feature name");
      return;
    }
    setIsGenerating(true);
    await generateFeatureMutation.mutateAsync({
      name: featureName,
      model: featureModel || undefined,
      includeApi,
      includeUi,
      includeTests
    });
    setIsGenerating(false);
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Code Generators</h1>
        <p className="text-muted-foreground">
          Generate boilerplate code for common patterns in DocuForge
        </p>
      </div>

      <Tabs defaultValue="router" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="router" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Router
          </TabsTrigger>
          <TabsTrigger value="component" className="flex items-center gap-2">
            <Component className="h-4 w-4" />
            Component
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
          <TabsTrigger value="feature" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Feature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="router">
          <Card>
            <CardHeader>
              <CardTitle>Generate tRPC Router</CardTitle>
              <CardDescription>
                Create a new tRPC router with optional CRUD operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="router-name">Router Name</Label>
                <Input
                  id="router-name"
                  placeholder="e.g., user, document, analytics"
                  value={routerName}
                  onChange={(e) => setRouterName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="router-model">Prisma Model Name (optional)</Label>
                <Input
                  id="router-model"
                  placeholder="Leave empty to use router name"
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-crud"
                  checked={includeCrud}
                  onCheckedChange={(checked) => setIncludeCrud(!!checked)}
                />
                <Label htmlFor="include-crud">Include CRUD operations</Label>
              </div>
              <Button 
                onClick={handleGenerateRouter} 
                disabled={isGenerating || !routerName}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Router
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="component">
          <Card>
            <CardHeader>
              <CardTitle>Generate React Component</CardTitle>
              <CardDescription>
                Create a new React component with tests and stories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="component-name">Component Name</Label>
                <Input
                  id="component-name"
                  placeholder="e.g., UserCard, DocumentList, AnalyticsChart"
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="component-type">Component Type</Label>
                <Select value={componentType} onValueChange={(v: any) => setComponentType(v)}>
                  <SelectTrigger id="component-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="component">Component</SelectItem>
                    <SelectItem value="page">Page</SelectItem>
                    <SelectItem value="form">Form</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="component-dir">Directory (optional)</Label>
                <Input
                  id="component-dir"
                  placeholder="e.g., features/analytics/components"
                  value={componentDir}
                  onChange={(e) => setComponentDir(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerateComponent} 
                disabled={isGenerating || !componentName}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Component
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="document">
          <Card>
            <CardHeader>
              <CardTitle>Generate Document Type</CardTitle>
              <CardDescription>
                Create a complete document type with all infrastructure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Document Type Name</Label>
                <Input
                  id="doc-name"
                  placeholder="e.g., Report, Invoice, Contract"
                  value={docTypeName}
                  onChange={(e) => setDocTypeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-description">Description</Label>
                <Textarea
                  id="doc-description"
                  placeholder="Describe the purpose of this document type"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sections to Include</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Introduction",
                    "Background",
                    "Main Content",
                    "Analysis",
                    "Conclusion",
                    "References",
                    "Appendix",
                    "Summary"
                  ].map((section) => (
                    <div key={section} className="flex items-center space-x-2">
                      <Checkbox
                        id={`section-${section}`}
                        checked={docSections.includes(section)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDocSections([...docSections, section]);
                          } else {
                            setDocSections(docSections.filter(s => s !== section));
                          }
                        }}
                      />
                      <Label htmlFor={`section-${section}`}>{section}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Export Formats</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["pdf", "docx", "markdown", "html", "txt"].map((format) => (
                    <div key={format} className="flex items-center space-x-2">
                      <Checkbox
                        id={`format-${format}`}
                        checked={docFormats.includes(format)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setDocFormats([...docFormats, format]);
                          } else {
                            setDocFormats(docFormats.filter(f => f !== format));
                          }
                        }}
                      />
                      <Label htmlFor={`format-${format}`}>{format.toUpperCase()}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleGenerateDocumentType} 
                disabled={isGenerating || !docTypeName}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Document Type
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Generate Tests</CardTitle>
              <CardDescription>
                Generate tests for a component or function
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-path">File Path</Label>
                <Input
                  id="test-path"
                  placeholder="e.g., src/components/UserCard.tsx"
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-type">Test Type</Label>
                <Select value={testType} onValueChange={(v: any) => setTestType(v)}>
                  <SelectTrigger id="test-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit Tests</SelectItem>
                    <SelectItem value="integration">Integration Tests</SelectItem>
                    <SelectItem value="e2e">E2E Tests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleGenerateTest} 
                disabled={isGenerating || !testPath}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Tests
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feature">
          <Card>
            <CardHeader>
              <CardTitle>Generate Complete Feature</CardTitle>
              <CardDescription>
                Generate a complete feature with API, UI, and tests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feature-name">Feature Name</Label>
                <Input
                  id="feature-name"
                  placeholder="e.g., UserManagement, Analytics, Billing"
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feature-model">Prisma Model Name (optional)</Label>
                <Input
                  id="feature-model"
                  placeholder="Leave empty to use feature name"
                  value={featureModel}
                  onChange={(e) => setFeatureModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Include Components</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-api"
                      checked={includeApi}
                      onCheckedChange={(checked) => setIncludeApi(!!checked)}
                    />
                    <Label htmlFor="include-api">API Routes (tRPC)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-ui"
                      checked={includeUi}
                      onCheckedChange={(checked) => setIncludeUi(!!checked)}
                    />
                    <Label htmlFor="include-ui">UI Components</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-tests"
                      checked={includeTests}
                      onCheckedChange={(checked) => setIncludeTests(!!checked)}
                    />
                    <Label htmlFor="include-tests">Tests</Label>
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleGenerateFeature} 
                disabled={isGenerating || !featureName}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Feature
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {generatedFiles.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generated Files
            </CardTitle>
            <CardDescription>
              The following files were created successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {generatedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="font-mono">
                    {file}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}