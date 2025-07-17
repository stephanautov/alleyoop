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
import { Alert, AlertDescription } from "~/components/ui/alert";
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
    Sparkles
} from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
    config: Record<string, any>;
}

export default function EnhancedGeneratorsPage() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
    const [streamOutput, setStreamOutput] = useState<string[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [templateDescription, setTemplateDescription] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");

    // Router generator state
    const [routerName, setRouterName] = useState("");
    const [routerModel, setRouterModel] = useState("");
    const [includeCrud, setIncludeCrud] = useState(true);

    // Check permissions
    const { data: permissions } = api.generators.checkPermissions.useQuery();

    // Get templates
    const { data: templates = [] } = api.generators.listTemplates.useQuery({
        generator: "router" // Change based on current tab
    });

    // Get history
    const { data: history = [] } = api.generators.getHistory.useQuery({
        limit: 5
    });

    // Subscribe to streaming output
    useEffect(() => {
        if (!currentSessionId) return;

        const subscription = api.generators.streamGeneration.subscribe(
            { sessionId: currentSessionId },
            {
                onData: (data) => {
                    if (data.type === "log") {
                        setStreamOutput(prev => [...prev, data.message || ""]);
                    } else if (data.type === "error") {
                        toast.error(data.message || "Generation error");
                    } else if (data.type === "file") {
                        toast.success(`Generated: ${data.file}`);
                    } else if (data.type === "complete") {
                        setIsGenerating(false);
                        toast.success("Generation complete!");
                    }
                },
                onError: (err) => {
                    toast.error("Streaming error: " + err.message);
                    setIsGenerating(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [currentSessionId]);

    // Mutations
    const generateRouterMutation = api.generators.generateRouterWithPreview.useMutation({
        onSuccess: async (data) => {
            setCurrentSessionId(data.sessionId);

            if (!showPreview) {
                toast.success("Router generated successfully!");
            }

            // Get generated files
            const files = await api.generators.getGeneratedFiles.query({
                sessionId: data.sessionId
            });
            setGeneratedFiles(files);
        },
        onError: (error) => {
            toast.error(error.message || "Failed to generate router");
            setIsGenerating(false);
        }
    });

    const undoMutation = api.generators.undoGeneration.useMutation({
        onSuccess: (data) => {
            if (data.success) {
                toast.success(`Deleted ${data.deleted.length} files`);
                setGeneratedFiles([]);
                setCurrentSessionId(null);
            } else {
                data.errors.forEach(err => toast.error(err));
            }
        }
    });

    const saveTemplateMutation = api.generators.saveTemplate.useMutation({
        onSuccess: () => {
            toast.success("Template saved!");
            setShowTemplateDialog(false);
            setTemplateName("");
            setTemplateDescription("");
        }
    });

    // Handlers
    const handleGenerateRouter = async (preview = false) => {
        if (!routerName) {
            toast.error("Please enter a router name");
            return;
        }

        if (!permissions?.canGenerate) {
            toast.error("You don't have permission to generate code");
            return;
        }

        setIsGenerating(true);
        setStreamOutput([]);
        setShowPreview(preview);

        await generateRouterMutation.mutateAsync({
            name: routerName,
            model: routerModel || undefined,
            crud: includeCrud,
            preview
        });
    };

    const handleUndo = async () => {
        if (!currentSessionId || !permissions?.canUndo) {
            toast.error("Cannot undo this generation");
            return;
        }

        await undoMutation.mutateAsync({ sessionId: currentSessionId });
    };

    const handleSaveTemplate = async () => {
        const config = {
            name: routerName,
            model: routerModel,
            crud: includeCrud
        };

        await saveTemplateMutation.mutateAsync({
            name: templateName,
            description: templateDescription,
            generator: "router",
            config
        });
    };

    const handleLoadTemplate = (template: Template) => {
        const config = template.config;
        setRouterName(config.name || "");
        setRouterModel(config.model || "");
        setIncludeCrud(config.crud ?? true);
        toast.success(`Loaded template: ${template.name}`);
    };

    return (
        <div className="container mx-auto py-6 max-w-7xl">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Code Generators</h1>
                    <p className="text-muted-foreground">
                        Generate boilerplate code with preview, templates, and undo
                    </p>
                </div>

                {/* Permission badges */}
                <div className="flex gap-2">
                    {permissions?.canGenerate && (
                        <Badge variant="secondary">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Can Generate
                        </Badge>
                    )}
                    {permissions?.canUndo && (
                        <Badge variant="secondary">
                            <Undo2 className="mr-1 h-3 w-3" />
                            Can Undo
                        </Badge>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Main content */}
                <div className="col-span-8">
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
                                    {/* Template selector */}
                                    {templates.length > 0 && (
                                        <div className="space-y-2">
                                            <Label htmlFor="template">Use Template</Label>
                                            <Select value={selectedTemplate} onValueChange={(id) => {
                                                const template = templates.find(t => t.id === id);
                                                if (template) handleLoadTemplate(template);
                                            }}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a template" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templates.map(template => (
                                                        <SelectItem key={template.id} value={template.id}>
                                                            <div>
                                                                <div className="font-medium">{template.name}</div>
                                                                {template.description && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {template.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

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

                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleGenerateRouter(true)}
                                            disabled={isGenerating || !routerName}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <Eye className="mr-2 h-4 w-4" />
                                            Preview
                                        </Button>
                                        <Button
                                            onClick={() => handleGenerateRouter(false)}
                                            disabled={isGenerating || !routerName}
                                            className="flex-1"
                                        >
                                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Generate
                                        </Button>
                                    </div>

                                    {/* Save as template button */}
                                    {routerName && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowTemplateDialog(true)}
                                            className="w-full"
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            Save as Template
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Other tabs would follow similar pattern */}
                    </Tabs>

                    {/* Stream output */}
                    {streamOutput.length > 0 && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="text-sm">Generation Output</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-48 w-full rounded-md border bg-black p-3">
                                    <div className="font-mono text-xs text-green-400">
                                        {streamOutput.map((line, i) => (
                                            <div key={i}>{line}</div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    {/* Generated files */}
                    {generatedFiles.length > 0 && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        Generated Files
                                    </span>
                                    {currentSessionId && permissions?.canUndo && !showPreview && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleUndo}
                                        >
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Undo Generation
                                        </Button>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Click on a file to view its content
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {generatedFiles.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                            onClick={() => setSelectedFile(file)}
                                        >
                                            <FileCode className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-mono text-sm">{file.path}</span>
                                            <Badge variant="secondary" className="ml-auto">
                                                {file.language}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="col-span-4 space-y-4">
                    {/* Recent generations */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Recent Generations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {history.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent generations</p>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((session) => (
                                        <div key={session.sessionId} className="text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{session.generator}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(session.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {session.files.length} files
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tips */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Pro Tips
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-sm">
                                <p className="font-medium">Preview First</p>
                                <p className="text-xs text-muted-foreground">
                                    Always preview before generating to avoid conflicts
                                </p>
                            </div>
                            <Separator />
                            <div className="text-sm">
                                <p className="font-medium">Use Templates</p>
                                <p className="text-xs text-muted-foreground">
                                    Save time by creating templates for common patterns
                                </p>
                            </div>
                            <Separator />
                            <div className="text-sm">
                                <p className="font-medium">Undo Quickly</p>
                                <p className="text-xs text-muted-foreground">
                                    You can undo generations if files haven't been modified
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* File preview dialog */}
            {selectedFile && (
                <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                            <DialogTitle className="font-mono text-sm">{selectedFile.path}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] w-full rounded-md border">
                            <SyntaxHighlighter
                                language={selectedFile.language}
                                style={vscDarkPlus}
                                customStyle={{ margin: 0 }}
                            >
                                {selectedFile.content}
                            </SyntaxHighlighter>
                        </ScrollArea>
                        <DialogFooter>
                            {showPreview ? (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedFile(null)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setSelectedFile(null);
                                            setShowPreview(false);
                                            handleGenerateRouter(false);
                                        }}
                                        className="flex-1"
                                    >
                                        Generate Files
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={() => setSelectedFile(null)}>Close</Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Save template dialog */}
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save as Template</DialogTitle>
                        <DialogDescription>
                            Save this configuration as a reusable template
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="template-name">Template Name</Label>
                            <Input
                                id="template-name"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="e.g., CRUD Router with Auth"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="template-description">Description (optional)</Label>
                            <Textarea
                                id="template-description"
                                value={templateDescription}
                                onChange={(e) => setTemplateDescription(e.target.value)}
                                placeholder="Describe when to use this template"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveTemplate} disabled={!templateName}>
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}