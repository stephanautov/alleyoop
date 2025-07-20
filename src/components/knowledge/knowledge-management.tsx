// src/components/knowledge/knowledge-management.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
    Upload,
    FileText,
    Link,
    Search,
    Trash2,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Database,
    FileUp,
    Globe,
    Loader2,
    X
} from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeManagementProps {
    onSourceSelect?: (sourceIds: string[]) => void;
    selectedSources?: string[];
    embedded?: boolean; // For use in document creation flow
}

export function KnowledgeManagement({
    onSourceSelect,
    selectedSources = [],
    embedded = false
}: KnowledgeManagementProps) {
    const [uploadType, setUploadType] = useState<"file" | "text" | "url">("file");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTab, setSelectedTab] = useState("upload");

    // File upload state
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Text/URL input state
    const [textContent, setTextContent] = useState("");
    const [urlInput, setUrlInput] = useState("");
    const [sourceName, setSourceName] = useState("");
    const [sourceDescription, setSourceDescription] = useState("");

    // API hooks
    const { data: sources, isLoading: sourcesLoading, refetch } = api.knowledge.list.useQuery({
        limit: 50,
    });

    const uploadMutation = api.knowledge.upload.useMutation({
        onSuccess: () => {
            toast.success("Knowledge source uploaded successfully");
            resetForm();
            refetch();
            setSelectedTab("browse");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to upload knowledge source");
            setIsUploading(false);
        },
    });

    const deleteMutation = api.knowledge.delete.useMutation({
        onSuccess: () => {
            toast.success("Knowledge source deleted");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "Failed to delete source");
        },
    });

    const searchMutation = api.knowledge.search.useMutation();

    // Dropzone configuration
    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt'],
            'text/markdown': ['.md'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        },
        maxFiles: 1,
        onDrop: (files) => {
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        },
    });

    const resetForm = () => {
        setTextContent("");
        setUrlInput("");
        setSourceName("");
        setSourceDescription("");
        setUploadProgress(0);
        setIsUploading(false);
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        setUploadProgress(10);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", sourceName || file.name);
        formData.append("description", sourceDescription);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        try {
            await uploadMutation.mutateAsync({
                type: "file",
                file: formData,
                name: sourceName || file.name,
                description: sourceDescription,
            });
            clearInterval(progressInterval);
            setUploadProgress(100);
        } catch (error) {
            clearInterval(progressInterval);
            setUploadProgress(0);
        }
    };

    const handleTextUpload = async () => {
        if (!textContent.trim() || !sourceName.trim()) {
            toast.error("Please provide both content and a name");
            return;
        }

        setIsUploading(true);
        await uploadMutation.mutateAsync({
            type: "text",
            content: textContent,
            name: sourceName,
            description: sourceDescription,
        });
    };

    const handleUrlUpload = async () => {
        if (!urlInput.trim() || !sourceName.trim()) {
            toast.error("Please provide both URL and a name");
            return;
        }

        setIsUploading(true);
        await uploadMutation.mutateAsync({
            type: "url",
            url: urlInput,
            name: sourceName,
            description: sourceDescription,
        });
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        const results = await searchMutation.mutateAsync({
            query: searchQuery,
            limit: 10,
        });

        // Results will be displayed in the search tab
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "PROCESSING":
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case "FAILED":
                return <X className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    const containerClass = embedded
        ? "w-full"
        : "container mx-auto py-6 space-y-6";

    return (
        <div className={containerClass}>
            {!embedded && (
                <div>
                    <h1 className="text-3xl font-bold">Knowledge Management</h1>
                    <p className="text-muted-foreground mt-2">
                        Upload and manage your knowledge base for enhanced document generation
                    </p>
                </div>
            )}

            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload
                    </TabsTrigger>
                    <TabsTrigger value="browse" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Browse
                    </TabsTrigger>
                    <TabsTrigger value="search" className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Search
                    </TabsTrigger>
                </TabsList>

                {/* Upload Tab */}
                <TabsContent value="upload" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Knowledge Source</CardTitle>
                            <CardDescription>
                                Upload documents, add text, or provide URLs to build your knowledge base
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Upload Type Selector */}
                            <div className="flex gap-2">
                                <Button
                                    variant={uploadType === "file" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setUploadType("file")}
                                >
                                    <FileUp className="h-4 w-4 mr-2" />
                                    File Upload
                                </Button>
                                <Button
                                    variant={uploadType === "text" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setUploadType("text")}
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Text Input
                                </Button>
                                <Button
                                    variant={uploadType === "url" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setUploadType("url")}
                                >
                                    <Globe className="h-4 w-4 mr-2" />
                                    URL
                                </Button>
                            </div>

                            {/* Common fields */}
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="source-name">Source Name</Label>
                                    <Input
                                        id="source-name"
                                        placeholder="e.g., Company Handbook, Research Paper"
                                        value={sourceName}
                                        onChange={(e) => setSourceName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="source-description">Description (Optional)</Label>
                                    <Textarea
                                        id="source-description"
                                        placeholder="Brief description of this knowledge source"
                                        value={sourceDescription}
                                        onChange={(e) => setSourceDescription(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {/* File Upload */}
                            {uploadType === "file" && (
                                <div>
                                    <div
                                        {...getRootProps()}
                                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                                            }`}
                                    >
                                        <input {...getInputProps()} />
                                        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                                        {acceptedFiles.length > 0 ? (
                                            <p className="text-sm">
                                                Selected: <span className="font-medium">{acceptedFiles[0].name}</span>
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-sm text-muted-foreground">
                                                    Drag & drop a file here, or click to select
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Supports PDF, TXT, MD, DOCX (Max 10MB)
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    {uploadProgress > 0 && uploadProgress < 100 && (
                                        <div className="mt-4">
                                            <Progress value={uploadProgress} className="h-2" />
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Uploading... {uploadProgress}%
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text Input */}
                            {uploadType === "text" && (
                                <div>
                                    <Label htmlFor="text-content">Content</Label>
                                    <Textarea
                                        id="text-content"
                                        placeholder="Paste or type your content here..."
                                        value={textContent}
                                        onChange={(e) => setTextContent(e.target.value)}
                                        rows={10}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            )}

                            {/* URL Input */}
                            {uploadType === "url" && (
                                <div>
                                    <Label htmlFor="url-input">URL</Label>
                                    <Input
                                        id="url-input"
                                        type="url"
                                        placeholder="https://example.com/document"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        We'll extract and process the content from this URL
                                    </p>
                                </div>
                            )}

                            {/* Upload Button */}
                            <Button
                                onClick={() => {
                                    if (uploadType === "file" && acceptedFiles.length > 0) {
                                        handleFileUpload(acceptedFiles[0]);
                                    } else if (uploadType === "text") {
                                        handleTextUpload();
                                    } else if (uploadType === "url") {
                                        handleUrlUpload();
                                    }
                                }}
                                disabled={isUploading || (uploadType === "file" && acceptedFiles.length === 0)}
                                className="w-full"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload Knowledge Source
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Browse Tab */}
                <TabsContent value="browse" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Knowledge Sources</CardTitle>
                            <CardDescription>
                                Manage your uploaded knowledge sources
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {sourcesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : sources?.sources.length === 0 ? (
                                <div className="text-center py-8">
                                    <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">No knowledge sources yet</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => setSelectedTab("upload")}
                                    >
                                        Upload First Source
                                    </Button>
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-3">
                                        {sources?.sources.map((source) => (
                                            <div
                                                key={source.id}
                                                className={`flex items-center justify-between p-4 rounded-lg border ${selectedSources.includes(source.id)
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    {onSourceSelect && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSources.includes(source.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    onSourceSelect([...selectedSources, source.id]);
                                                                } else {
                                                                    onSourceSelect(
                                                                        selectedSources.filter((id) => id !== source.id)
                                                                    );
                                                                }
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    )}
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium">{source.name}</h4>
                                                            {getStatusIcon(source.status)}
                                                        </div>
                                                        {source.description && (
                                                            <p className="text-sm text-muted-foreground">
                                                                {source.description}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span>{source.type}</span>
                                                            {source.fileSize && (
                                                                <span>{(source.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                                            )}
                                                            <span>
                                                                {formatDistanceToNow(new Date(source.createdAt), {
                                                                    addSuffix: true,
                                                                })}
                                                            </span>
                                                            {source.embeddings?.length > 0 && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {source.embeddings.length} chunks
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteMutation.mutate({ id: source.id })}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Search Tab */}
                <TabsContent value="search" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Search Knowledge Base</CardTitle>
                            <CardDescription>
                                Find relevant information across all your knowledge sources
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search for information..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                                />
                                <Button
                                    onClick={handleSearch}
                                    disabled={searchMutation.isPending || !searchQuery.trim()}
                                >
                                    {searchMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {searchMutation.data && (
                                <div className="space-y-3">
                                    {searchMutation.data.results.length === 0 ? (
                                        <Alert>
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                No results found for "{searchQuery}"
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        searchMutation.data.results.map((result, index) => (
                                            <Card key={index} className="p-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <h4 className="font-medium text-sm">{result.sourceName}</h4>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {Math.round(result.similarity * 100)}% match
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                                        {result.content}
                                                    </p>
                                                    {result.metadata && (
                                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                                            {result.metadata.section && (
                                                                <span>Section: {result.metadata.section}</span>
                                                            )}
                                                            {result.metadata.page && (
                                                                <span>Page: {result.metadata.page}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}