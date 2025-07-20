// src/components/document-editor.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, Download, Undo, Redo, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "sonner";
import { DocumentType } from "@prisma/client";

interface Section {
    id: string;
    title: string;
    content: string;
    order: number;
}

interface DocumentEditorProps {
    documentId: string;
    initialTitle: string;
    initialContent: any;
    documentType: DocumentType;
    onSave?: (data: { title: string; content: any }) => Promise<void>;
    onExport?: (format: string) => Promise<void>;
    isAutoSaveEnabled?: boolean;
    autoSaveInterval?: number; // in milliseconds
}

export function DocumentEditor({
    documentId,
    initialTitle,
    initialContent,
    documentType,
    onSave,
    onExport,
    isAutoSaveEnabled = true,
    autoSaveInterval = 30000, // 30 seconds
}: DocumentEditorProps) {
    const [title, setTitle] = useState(initialTitle);
    const [sections, setSections] = useState<Section[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [history, setHistory] = useState<{ title: string; sections: Section[] }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Parse initial content into sections
    useEffect(() => {
        if (initialContent) {
            const parsedSections = parseContentToSections(initialContent, documentType);
            setSections(parsedSections);
            // Initialize history
            setHistory([{ title: initialTitle, sections: parsedSections }]);
            setHistoryIndex(0);
        }
    }, [initialContent, initialTitle, documentType]);

    // Auto-save functionality
    useEffect(() => {
        if (!isAutoSaveEnabled || !onSave) return;

        const autoSaveTimer = setInterval(async () => {
            await handleSave(true);
        }, autoSaveInterval);

        return () => clearInterval(autoSaveTimer);
    }, [title, sections, isAutoSaveEnabled, autoSaveInterval]);

    const parseContentToSections = (content: any, type: DocumentType): Section[] => {
        // This would be customized based on document type
        if (typeof content === 'string') {
            return [{
                id: '1',
                title: 'Content',
                content: content,
                order: 0
            }];
        }

        if (Array.isArray(content)) {
            return content.map((section, index) => ({
                id: String(index + 1),
                title: section.title || `Section ${index + 1}`,
                content: section.content || '',
                order: index
            }));
        }

        // Handle object-based content
        return Object.entries(content).map(([key, value], index) => ({
            id: String(index + 1),
            title: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            content: String(value),
            order: index
        }));
    };

    const handleSave = async (isAutoSave = false) => {
        if (!onSave) return;

        setIsSaving(true);
        try {
            const content = sectionsToContent(sections, documentType);
            await onSave({ title, content });
            setLastSaved(new Date());
            if (!isAutoSave) {
                toast.success("Document saved successfully");
            }
        } catch (error) {
            toast.error("Failed to save document");
        } finally {
            setIsSaving(false);
        }
    };

    const sectionsToContent = (sections: Section[], type: DocumentType): any => {
        // Convert sections back to the appropriate format for the document type
        // This is a simplified version - you'd customize based on document type
        if (sections.length === 1) {
            return sections[0].content;
        }

        return sections.reduce((acc, section) => {
            const key = section.title.toLowerCase().replace(/\s+/g, '_');
            acc[key] = section.content;
            return acc;
        }, {} as any);
    };

    const updateSection = (id: string, updates: Partial<Section>) => {
        setSections(prev => {
            const newSections = prev.map(section =>
                section.id === id ? { ...section, ...updates } : section
            );
            addToHistory(title, newSections);
            return newSections;
        });
    };

    const addToHistory = (newTitle: string, newSections: Section[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ title: newTitle, sections: newSections });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prevState = history[historyIndex - 1];
            setTitle(prevState.title);
            setSections(prevState.sections);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextState = history[historyIndex + 1];
            setTitle(nextState.title);
            setSections(nextState.sections);
            setHistoryIndex(historyIndex + 1);
        }
    };

    const copyToClipboard = async () => {
        const content = sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n');
        try {
            await navigator.clipboard.writeText(content);
            toast.success("Content copied to clipboard");
        } catch (error) {
            toast.error("Failed to copy content");
        }
    };

    const handleExport = async (format: string) => {
        if (!onExport) return;

        try {
            await onExport(format);
        } catch (error) {
            toast.error(`Failed to export as ${format.toUpperCase()}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleSave(false)}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Save Document</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={undo}
                                            disabled={historyIndex <= 0}
                                        >
                                            <Undo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Undo</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={redo}
                                            disabled={historyIndex >= history.length - 1}
                                        >
                                            <Redo className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Redo</TooltipContent>
                                </Tooltip>

                                <Separator orientation="vertical" className="h-8" />

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={copyToClipboard}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy to Clipboard</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowPreview(!showPreview)}
                                        >
                                            {showPreview ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {showPreview ? "Hide Preview" : "Show Preview"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <div className="flex items-center gap-4">
                            {lastSaved && (
                                <span className="text-sm text-muted-foreground">
                                    Last saved: {lastSaved.toLocaleTimeString()}
                                </span>
                            )}

                            {isAutoSaveEnabled && (
                                <Badge variant="secondary">Auto-save enabled</Badge>
                            )}

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleExport("pdf")}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleExport("docx")}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    DOCX
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Editor */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Document Title</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    addToHistory(e.target.value, sections);
                                }}
                                placeholder="Enter document title"
                                className="text-lg font-semibold"
                            />
                        </CardContent>
                    </Card>

                    {sections.map((section) => (
                        <Card key={section.id}>
                            <CardHeader>
                                <Input
                                    value={section.title}
                                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                    className="text-lg font-semibold"
                                    placeholder="Section title"
                                />
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={section.content}
                                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                                    placeholder="Enter content..."
                                    className="min-h-[200px] resize-y"
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Preview */}
                {showPreview && (
                    <div className="lg:sticky lg:top-6">
                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle>Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm max-w-none">
                                    <h1 className="text-2xl font-bold mb-4">{title}</h1>
                                    {sections.map((section) => (
                                        <div key={section.id} className="mb-6">
                                            <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
                                            <div className="whitespace-pre-wrap">{section.content}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}