// src/components/ui/empty-states.tsx
"use client";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
    FileText,
    FolderOpen,
    Search,
    AlertCircle,
    Database,
    Upload,
    Plus,
    ArrowRight,
    BookOpen,
    Sparkles,
    RefreshCw,
    BarChart3
} from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    secondaryAction?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon: Icon = FolderOpen,
    title,
    description,
    action,
    secondaryAction,
    className
}: EmptyStateProps) {
    return (
        <div className={cn(
            "flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
            className
        )}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            {description && (
                <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            )}
            {(action || secondaryAction) && (
                <div className="mt-6 flex items-center gap-2">
                    {action && (
                        action.href ? (
                            <Button asChild>
                                <Link href={action.href}>
                                    {action.label}
                                </Link>
                            </Button>
                        ) : (
                            <Button onClick={action.onClick}>
                                {action.label}
                            </Button>
                        )
                    )}
                    {secondaryAction && (
                        secondaryAction.href ? (
                            <Button variant="outline" asChild>
                                <Link href={secondaryAction.href}>
                                    {secondaryAction.label}
                                </Link>
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={secondaryAction.onClick}>
                                {secondaryAction.label}
                            </Button>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

// Preset empty states for common scenarios
export function NoDocumentsEmptyState() {
    return (
        <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Get started by creating your first document. Choose from various types like biographies, business plans, and more."
            action={{
                label: "Create Document",
                href: "/documents/new"
            }}
            secondaryAction={{
                label: "Upload Knowledge",
                href: "/knowledge"
            }}
        />
    );
}

export function NoSearchResultsEmptyState({ query }: { query: string }) {
    return (
        <EmptyState
            icon={Search}
            title="No results found"
            description={`We couldn't find any documents matching "${query}". Try adjusting your search terms.`}
        />
    );
}

export function NoKnowledgeSourcesEmptyState() {
    return (
        <EmptyState
            icon={Database}
            title="No knowledge sources"
            description="Upload documents, add text, or provide URLs to build your knowledge base for enhanced document generation."
            action={{
                label: "Upload First Source",
                href: "/knowledge?tab=upload"
            }}
        />
    );
}

export function ErrorEmptyState({
    title = "Something went wrong",
    description = "An error occurred while loading this content. Please try again.",
    onRetry
}: {
    title?: string;
    description?: string;
    onRetry?: () => void;
}) {
    return (
        <EmptyState
            icon={AlertCircle}
            title={title}
            description={description}
            action={onRetry ? {
                label: "Try Again",
                onClick: onRetry
            } : undefined}
        />
    );
}

// Loading states
export function LoadingState({
    message = "Loading...",
    className
}: {
    message?: string;
    className?: string;
}) {
    return (
        <div className={cn(
            "flex min-h-[400px] flex-col items-center justify-center",
            className
        )}>
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">{message}</p>
        </div>
    );
}

// Feature-specific empty states
export function WelcomeEmptyState({ userName }: { userName?: string }) {
    return (
        <div className="relative overflow-hidden rounded-lg border bg-background p-8">
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                    <h2 className="text-2xl font-bold">
                        Welcome{userName ? `, ${userName}` : ''} to DocuForge!
                    </h2>
                </div>
                <p className="mb-6 text-muted-foreground max-w-2xl">
                    Create professional documents powered by AI. Start by uploading your knowledge base
                    or jump right into creating your first document.
                </p>
                <div className="flex flex-wrap gap-4">
                    <Button asChild size="lg">
                        <Link href="/documents/new">
                            <Plus className="mr-2 h-5 w-5" />
                            Create Document
                        </Link>
                    </Button>
                    <Button variant="outline" asChild size="lg">
                        <Link href="/knowledge">
                            <BookOpen className="mr-2 h-5 w-5" />
                            Manage Knowledge
                        </Link>
                    </Button>
                    <Button variant="ghost" asChild size="lg">
                        <Link href="/help/getting-started">
                            Learn More
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
            {/* Background decoration */}
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        </div>
    );
}

// Analytics empty state
export function NoAnalyticsDataEmptyState() {
    return (
        <EmptyState
            icon={BarChart3}
            title="No analytics data yet"
            description="Start creating documents to see usage statistics, costs, and performance metrics."
            action={{
                label: "Create First Document",
                href: "/documents/new"
            }}
        />
    );
}

// Upload progress empty state (for drag and drop areas)
export function UploadDropZone({
    isActive,
    acceptedTypes,
    className
}: {
    isActive?: boolean;
    acceptedTypes?: string[];
    className?: string;
}) {
    return (
        <div className={cn(
            "flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            isActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            className
        )}>
            <Upload className={cn(
                "h-10 w-10 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
            )} />
            <p className="mt-4 text-sm font-medium">
                {isActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
                {acceptedTypes ? `Accepts: ${acceptedTypes.join(", ")}` : "or click to browse"}
            </p>
        </div>
    );
}