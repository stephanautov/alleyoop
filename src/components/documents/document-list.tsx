// src/components/document-list.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
    FileText,
    MoreVertical,
    Eye,
    Download,
    Trash2,
    Edit,
    Copy,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";
import { DocumentStatus } from "@prisma/client";

interface Document {
    id: string;
    title: string;
    description?: string | null;
    documentType: string;
    status: DocumentStatus;
    createdAt: Date;
    updatedAt: Date;
}

interface DocumentListProps {
    documents: Document[];
    isLoading?: boolean;
    onDelete?: (id: string) => Promise<void>;
    onDuplicate?: (id: string) => Promise<void>;
    onExport?: (id: string, format: string) => Promise<void>;
}

const statusConfig = {
    [DocumentStatus.DRAFT]: {
        label: "Draft",
        icon: Edit,
        variant: "secondary" as const,
    },
    [DocumentStatus.PENDING]: {
        label: "Pending",
        icon: Clock,
        variant: "warning" as const,
    },
    [DocumentStatus.PROCESSING]: {
        label: "Processing",
        icon: Loader2,
        variant: "default" as const,
    },
    [DocumentStatus.COMPLETED]: {
        label: "Completed",
        icon: CheckCircle,
        variant: "success" as const,
    },
    [DocumentStatus.FAILED]: {
        label: "Failed",
        icon: XCircle,
        variant: "destructive" as const,
    },
    [DocumentStatus.ARCHIVED]: {
        label: "Archived",
        icon: FileText,
        variant: "outline" as const,
    },
};

function DocumentCard({
    document,
    onDelete,
    onDuplicate,
    onExport
}: {
    document: Document;
    onDelete?: (id: string) => Promise<void>;
    onDuplicate?: (id: string) => Promise<void>;
    onExport?: (id: string, format: string) => Promise<void>;
}) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const status = statusConfig[document.status];
    const StatusIcon = status.icon;

    const handleDelete = async () => {
        if (!onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(document.id);
            toast.success("Document deleted successfully");
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error("Failed to delete document");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDuplicate = async () => {
        if (!onDuplicate) return;

        try {
            await onDuplicate(document.id);
            toast.success("Document duplicated successfully");
        } catch (error) {
            toast.error("Failed to duplicate document");
        }
    };

    const handleExport = async (format: string) => {
        if (!onExport) return;

        try {
            await onExport(document.id, format);
            toast.success(`Document exported as ${format.toUpperCase()}`);
        } catch (error) {
            toast.error("Failed to export document");
        }
    };

    return (
        <>
            <Card className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="line-clamp-1">
                                <Link
                                    href={`/documents/${document.id}`}
                                    className="hover:underline"
                                >
                                    {document.title}
                                </Link>
                            </CardTitle>
                            {document.description && (
                                <CardDescription className="line-clamp-2">
                                    {document.description}
                                </CardDescription>
                            )}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/documents/${document.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                    </Link>
                                </DropdownMenuItem>
                                {document.status !== DocumentStatus.PROCESSING && (
                                    <DropdownMenuItem asChild>
                                        <Link href={`/documents/${document.id}/edit`}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={handleDuplicate}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export as PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("docx")}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export as DOCX
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setDeleteDialogOpen(true)}
                                    className="text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                            <Badge variant={status.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                            </Badge>
                            <span className="text-muted-foreground capitalize">
                                {document.documentType.toLowerCase().replace("_", " ")}
                            </span>
                        </div>
                        <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{document.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function DocumentListSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <Card key={i}>
                    <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function DocumentList({
    documents,
    isLoading = false,
    onDelete,
    onDuplicate,
    onExport
}: DocumentListProps) {
    if (isLoading) {
        return <DocumentListSkeleton />;
    }

    if (documents.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                    <p className="text-muted-foreground text-center mb-6">
                        Create your first document to get started
                    </p>
                    <Button asChild>
                        <Link href="/documents/new">Create Document</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {documents.map((document) => (
                <DocumentCard
                    key={document.id}
                    document={document}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onExport={onExport}
                />
            ))}
        </div>
    );
}