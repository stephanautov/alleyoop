// src/app/documents/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DocumentList } from "@/components/document-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Filter,
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    Archive,
    Loader2
} from "lucide-react";
import { DocumentStatus, DocumentType } from "@/server/db/schema/documents";
import { toast } from "sonner";

interface Document {
    id: string;
    title: string;
    description?: string | null;
    documentType: DocumentType;
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
}

const statusFilters = [
    { value: "all", label: "All Documents", icon: FileText },
    { value: DocumentStatus.COMPLETED, label: "Completed", icon: CheckCircle },
    { value: DocumentStatus.PROCESSING, label: "Processing", icon: Clock },
    { value: DocumentStatus.DRAFT, label: "Drafts", icon: FileText },
    { value: DocumentStatus.FAILED, label: "Failed", icon: XCircle },
    { value: DocumentStatus.ARCHIVED, label: "Archived", icon: Archive },
];

export default function DocumentsPage() {
    const { userId } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortBy, setSortBy] = useState("updatedAt");

    if (!userId) {
        router.push("/sign-in");
        return null;
    }

    useEffect(() => {
        fetchDocuments();
    }, [userId]);

    useEffect(() => {
        filterAndSortDocuments();
    }, [documents, searchQuery, statusFilter, typeFilter, sortBy]);

    const fetchDocuments = async () => {
        try {
            const response = await fetch("/api/documents");
            if (!response.ok) throw new Error("Failed to fetch documents");

            const data = await response.json();
            setDocuments(data);
        } catch (error) {
            toast.error("Failed to load documents");
        } finally {
            setIsLoading(false);
        }
    };

    const filterAndSortDocuments = () => {
        let filtered = [...documents];

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(doc =>
                doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        // Status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(doc => doc.status === statusFilter);
        }

        // Type filter
        if (typeFilter !== "all") {
            filtered = filtered.filter(doc => doc.documentType === typeFilter);
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case "title":
                    return a.title.localeCompare(b.title);
                case "createdAt":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case "updatedAt":
                default:
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
        });

        setFilteredDocuments(filtered);
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/documents/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete document");

            setDocuments(prev => prev.filter(doc => doc.id !== id));
            toast.success("Document deleted successfully");
        } catch (error) {
            toast.error("Failed to delete document");
            throw error;
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            const response = await fetch(`/api/documents/${id}/duplicate`, {
                method: "POST",
            });

            if (!response.ok) throw new Error("Failed to duplicate document");

            const newDocument = await response.json();
            setDocuments(prev => [newDocument, ...prev]);
            toast.success("Document duplicated successfully");
        } catch (error) {
            toast.error("Failed to duplicate document");
            throw error;
        }
    };

    const handleExport = async (id: string, format: string) => {
        try {
            const response = await fetch(`/api/documents/${id}/export?format=${format}`);

            if (!response.ok) throw new Error("Failed to export document");

            // Handle file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `document.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Document exported as ${format.toUpperCase()}`);
        } catch (error) {
            toast.error("Failed to export document");
            throw error;
        }
    };

    const getStatusCounts = () => {
        const counts: Record<string, number> = {
            all: documents.length,
        };

        statusFilters.slice(1).forEach(filter => {
            counts[filter.value] = documents.filter(doc => doc.status === filter.value).length;
        });

        return counts;
    };

    const statusCounts = getStatusCounts();

    return (
        <div className="container max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">My Documents</h1>
                    <p className="text-muted-foreground">
                        Manage and organize your AI-generated documents
                    </p>
                </div>
                <Button asChild>
                    <Link href="/documents/new">
                        <Plus className="h-4 w-4 mr-2" />
                        New Document
                    </Link>
                </Button>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input
                                    placeholder="Search documents..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Document Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value={DocumentType.BIOGRAPHY}>Biography</SelectItem>
                                    <SelectItem value={DocumentType.BUSINESS_PLAN}>Business Plan</SelectItem>
                                    <SelectItem value={DocumentType.CASE_SUMMARY}>Case Summary</SelectItem>
                                    <SelectItem value={DocumentType.GRANT_PROPOSAL}>Grant Proposal</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="updatedAt">Last Modified</SelectItem>
                                    <SelectItem value="createdAt">Date Created</SelectItem>
                                    <SelectItem value="title">Title</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Status Tabs */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
                <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto">
                    {statusFilters.map((filter) => {
                        const Icon = filter.icon;
                        const count = statusCounts[filter.value] || 0;

                        return (
                            <TabsTrigger
                                key={filter.value}
                                value={filter.value}
                                className="flex items-center gap-2 data-[state=active]:bg-background"
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{filter.label}</span>
                                <Badge variant="secondary" className="ml-1 h-5 px-1">
                                    {count}
                                </Badge>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            {/* Document List */}
            <DocumentList
                documents={filteredDocuments}
                isLoading={isLoading}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onExport={handleExport}
            />

            {/* Empty State for Filtered Results */}
            {!isLoading && filteredDocuments.length === 0 && documents.length > 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Search className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                        <p className="text-muted-foreground text-center mb-6">
                            Try adjusting your filters or search query
                        </p>
                        <Button variant="outline" onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setTypeFilter("all");
                        }}>
                            Clear Filters
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}