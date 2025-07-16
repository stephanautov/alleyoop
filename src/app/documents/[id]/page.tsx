import { notFound, redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import Link from "next/link";
import {
    ArrowLeft,
    Download,
    Eye,
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    DollarSign,
    Hash,
    Calendar,
    RefreshCw,
    Trash2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getDocumentConfig } from "~/config/documents";
import { DocumentStatus, ExportFormat } from "@prisma/client";
import { DocumentActions } from "./document-actions";
import { ExportDropdown } from "./export-dropdown";
import { DocumentProgress } from "./document-progress";

interface PageProps {
    params: {
        id: string;
    };
}

export default async function DocumentDetailPage({ params }: PageProps) {
    const session = await getServerAuthSession();
    if (!session) {
        redirect("/api/auth/signin");
    }

    let document;
    try {
        document = await api.document.getById.query({ id: params.id });
    } catch (error) {
        notFound();
    }

    const config = getDocumentConfig(document.type);
    const isProcessing =
        document.status === DocumentStatus.PENDING ||
        document.status === DocumentStatus.PROCESSING;

    return (
        <div className="container mx-auto py-6 space-y-6">
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
                <div className="flex items-center gap-2">
                    {document.status === DocumentStatus.COMPLETED && (
                        <ExportDropdown documentId={document.id} formats={config.exportFormats} />
                    )}
                    <DocumentActions document={document} />
                </div>
            </div>

            {/* Document Info */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl">{document.title}</CardTitle>
                            <CardDescription className="flex items-center gap-4">
                                <Badge variant="secondary">{config.name}</Badge>
                                <span className="flex items-center gap-1 text-sm">
                                    <Calendar className="h-3 w-3" />
                                    Created {formatDistanceToNow(document.createdAt, { addSuffix: true })}
                                </span>
                            </CardDescription>
                        </div>
                        <DocumentStatusBadge status={document.status} />
                    </div>
                </CardHeader>
            </Card>

            {/* Progress or Content */}
            {isProcessing ? (
                <DocumentProgress documentId={document.id} />
            ) : document.status === DocumentStatus.FAILED ? (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                        Document generation failed. Please try again or contact support if the issue persists.
                    </AlertDescription>
                </Alert>
            ) : document.status === DocumentStatus.CANCELLED ? (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Document generation was cancelled.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Content</CardTitle>
                                <CardDescription>
                                    {document.wordCount?.toLocaleString()} words
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="content" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="content">Content</TabsTrigger>
                                        <TabsTrigger value="outline">Outline</TabsTrigger>
                                        <TabsTrigger value="input">Input Data</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="content" className="space-y-6 mt-6">
                                        {document.sections && Array.isArray(document.sections) ? (
                                            (document.sections as any[])
                                                .sort((a, b) => a.order - b.order)
                                                .map((section) => (
                                                    <div key={section.id} className="space-y-2">
                                                        <h3 className="text-lg font-semibold">{section.name}</h3>
                                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                                            {section.content.split('\n\n').map((paragraph: string, i: number) => (
                                                                <p key={i} className="text-muted-foreground">
                                                                    {paragraph}
                                                                </p>
                                                            ))}
                                                        </div>
                                                        {section.order < (document.sections as any[]).length && (
                                                            <Separator className="my-6" />
                                                        )}
                                                    </div>
                                                ))
                                        ) : (
                                            <p className="text-muted-foreground">No content available</p>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="outline" className="mt-6">
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                                                {document.outline ?
                                                    (typeof document.outline === 'string'
                                                        ? document.outline
                                                        : (document.outline as any).content || JSON.stringify(document.outline, null, 2)
                                                    ) : 'No outline available'}
                                            </pre>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="input" className="mt-6">
                                        <div className="rounded-lg bg-muted p-4">
                                            <pre className="text-sm">
                                                {JSON.stringify(document.input, null, 2)}
                                            </pre>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Document Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Status</span>
                                    <DocumentStatusBadge status={document.status} />
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type</span>
                                    <span className="font-medium">{config.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Created</span>
                                    <span className="font-medium">
                                        {format(document.createdAt, "MMM d, yyyy")}
                                    </span>
                                </div>
                                {document.completedAt && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Completed</span>
                                        <span className="font-medium">
                                            {format(document.completedAt, "MMM d, yyyy")}
                                        </span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Word Count</span>
                                    <span className="font-medium">
                                        {document.wordCount?.toLocaleString() || "0"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tokens Used</span>
                                    <span className="font-medium">
                                        {((document.promptTokens || 0) + (document.completionTokens || 0)).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cost</span>
                                    <span className="font-medium flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        {document.totalCost?.toFixed(2) || "0.00"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Export History */}
                        {document.exports && document.exports.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Export History</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {document.exports.map((exp: any) => (
                                        <div key={exp.id} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <span>{exp.format}</span>
                                            </div>
                                            <span className="text-muted-foreground">
                                                {formatDistanceToNow(exp.createdAt, { addSuffix: true })}
                                            </span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions */}
                        {document.status === DocumentStatus.COMPLETED && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Quick Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start" asChild>
                                        <Link href={`/documents/new?type=${document.type}&clone=${document.id}`}>
                                            <FileText className="mr-2 h-4 w-4" />
                                            Create Similar
                                        </Link>
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start" asChild>
                                        <Link href={`/api/export/${document.id}?format=pdf&preview=true`} target="_blank">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Preview PDF
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Components
function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
    const statusConfig = {
        [DocumentStatus.PENDING]: {
            icon: Clock,
            color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
            label: "Pending",
        },
        [DocumentStatus.PROCESSING]: {
            icon: Clock,
            color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
            label: "Processing",
        },
        [DocumentStatus.COMPLETED]: {
            icon: CheckCircle,
            color: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
            label: "Completed",
        },
        [DocumentStatus.FAILED]: {
            icon: XCircle,
            color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
            label: "Failed",
        },
        [DocumentStatus.CANCELLED]: {
            icon: AlertCircle,
            color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
            label: "Cancelled",
        },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <Badge className={`${config.color} border-0`}>
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
        </Badge>
    );
}