//src/app/documents/[id]/document-actions.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "~/components/ui/button";
import { MoreVertical, Trash2, RefreshCw, XCircle, FileText, Copy } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { DocumentStatus } from "@prisma/client";

interface DocumentActionsProps {
    document: {
        id: string;
        status: DocumentStatus;
        title: string;
        type: string;
    };
}

export function DocumentActions({ document }: DocumentActionsProps) {
    const router = useRouter();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const utils = api.useUtils();

    const deleteDocument = api.document.delete.useMutation({
        onSuccess: () => {
            toast.success("Document deleted successfully");
            router.push("/dashboard");
        },
        onError: (error) => {
            toast.error(error.message ?? "Failed to delete document");
            setIsDeleting(false);
        },
    });

    const retryDocument = api.document.retry.useMutation({
        onSuccess: () => {
            toast.success("Document generation restarted");
            router.refresh();
        },
        onError: (error) => {
            toast.error(error.message ?? "Failed to retry document");
        },
    });

    const cancelDocument = api.document.cancel.useMutation({
        onSuccess: () => {
            toast.success("Document generation cancelled");
            router.refresh();
        },
        onError: (error) => {
            toast.error(error.message ?? "Failed to cancel document");
        },
    });

    const handleDelete = async () => {
        setIsDeleting(true);
        await deleteDocument.mutateAsync({ id: document.id });
    };

    const handleRetry = async () => {
        await retryDocument.mutateAsync({ documentId: document.id });
    };

    const handleCancel = async () => {
        await cancelDocument.mutateAsync({ documentId: document.id });
    };

    const handleDuplicate = () => {
        router.push(`/documents/new?type=${document.type}&clone=${document.id}`);
    };

    const isProcessing =
        document.status === DocumentStatus.PENDING ||
        document.status === DocumentStatus.PROCESSING;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {document.status === DocumentStatus.COMPLETED && (
                        <>
                            <DropdownMenuItem onClick={handleDuplicate}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {document.status === DocumentStatus.FAILED && (
                        <>
                            <DropdownMenuItem onClick={handleRetry}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry Generation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {isProcessing && (
                        <>
                            <DropdownMenuItem onClick={handleCancel}>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{document.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}