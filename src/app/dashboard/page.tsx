import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth-compat";
import { api } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import Link from "next/link";
import {
    FileText,
    Plus,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Download,
    Eye,
    MoreVertical,
    TrendingUp,
    FileIcon,
    DollarSign
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { getDocumentConfig } from "~/config/documents";
import { DocumentStatus } from "@prisma/client";

export default async function DashboardPage() {
    const session = await getServerAuthSession();
    if (!session) {
        redirect("/api/auth/signin");
    }

    // Fetch user data
    const [documents, stats, availableTypes] = await Promise.all([
        api.document.list.query({ pagination: { limit: 10 } }),
        api.document.getStats.query(),
        api.document.getAvailableTypes.query(),
    ]);

    return (
        <div className="container mx-auto py-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back, {session.user.name || session.user.email}
                    </p>
                </div>
                <Link href="/documents/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Document
                    </Button>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">
                            <TrendingUp className="inline h-3 w-3 text-green-500" /> +12% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.byStatus[DocumentStatus.COMPLETED] || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Ready for export
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Processing</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(stats.byStatus[DocumentStatus.PENDING] || 0) +
                                (stats.byStatus[DocumentStatus.PROCESSING] || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            In progress
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${stats.totalCost.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            API usage costs
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Start</CardTitle>
                    <CardDescription>Create a new document with one click</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {availableTypes.map((type) => {
                            const Icon = getIconComponent(type.icon);
                            return (
                                <Link key={type.type} href={`/documents/new?type=${type.type}`}>
                                    <Button variant="outline" className="w-full justify-start">
                                        <Icon className="mr-2 h-4 w-4" />
                                        {type.name}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Recent Documents */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Documents</CardTitle>
                    <CardDescription>Your latest document creations</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                            <TabsTrigger value="processing">Processing</TabsTrigger>
                            <TabsTrigger value="failed">Failed</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="space-y-4">
                            {documents.items.length === 0 ? (
                                <div className="text-center py-8">
                                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
                                    <p className="text-muted-foreground">
                                        Create your first document to get started
                                    </p>
                                    <Link href="/documents/new">
                                        <Button className="mt-4">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Document
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {documents.items.map((doc) => (
                                        <DocumentCard key={doc.id} document={doc} />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="completed" className="space-y-4">
                            {documents.items
                                .filter((doc) => doc.status === DocumentStatus.COMPLETED)
                                .map((doc) => (
                                    <DocumentCard key={doc.id} document={doc} />
                                ))}
                        </TabsContent>
                        <TabsContent value="processing" className="space-y-4">
                            {documents.items
                                .filter(
                                    (doc) =>
                                        doc.status === DocumentStatus.PENDING ||
                                        doc.status === DocumentStatus.PROCESSING
                                )
                                .map((doc) => (
                                    <DocumentCard key={doc.id} document={doc} />
                                ))}
                        </TabsContent>
                        <TabsContent value="failed" className="space-y-4">
                            {documents.items
                                .filter((doc) => doc.status === DocumentStatus.FAILED)
                                .map((doc) => (
                                    <DocumentCard key={doc.id} document={doc} />
                                ))}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

// Document Card Component
function DocumentCard({ document }: { document: any }) {
    const config = getDocumentConfig(document.type);
    const Icon = getIconComponent(config.icon);

    const statusConfig = {
        [DocumentStatus.PENDING]: {
            icon: Clock,
            color: "text-yellow-500",
            bg: "bg-yellow-50 dark:bg-yellow-900/20",
            label: "Pending",
        },
        [DocumentStatus.PROCESSING]: {
            icon: Clock,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-900/20",
            label: "Processing",
        },
        [DocumentStatus.COMPLETED]: {
            icon: CheckCircle,
            color: "text-green-500",
            bg: "bg-green-50 dark:bg-green-900/20",
            label: "Completed",
        },
        [DocumentStatus.FAILED]: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-50 dark:bg-red-900/20",
            label: "Failed",
        },
        [DocumentStatus.CANCELLED]: {
            icon: AlertCircle,
            color: "text-gray-500",
            bg: "bg-gray-50 dark:bg-gray-900/20",
            label: "Cancelled",
        },
    };

    const status = statusConfig[document.status];
    const StatusIcon = status.icon;

    return (
        <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2 ${status.bg}`}>
                    <Icon className={`h-5 w-5 ${status.color}`} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{document.title}</h3>
                        <Badge variant="secondary" className="text-xs">
                            {config.name}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${status.color}`} />
                            {status.label}
                        </span>
                        <span>
                            {formatDistanceToNow(new Date(document.createdAt), {
                                addSuffix: true,
                            })}
                        </span>
                        {document.wordCount > 0 && (
                            <span>{document.wordCount.toLocaleString()} words</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {document.status === DocumentStatus.PROCESSING && (
                    <Progress value={50} className="w-20" />
                )}
                {document.status === DocumentStatus.COMPLETED && (
                    <>
                        <Link href={`/documents/${document.id}`}>
                            <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                            </Button>
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {config.exportFormats.map((format) => (
                                    <DropdownMenuItem key={format} asChild>
                                        <Link href={`/api/export/${document.id}?format=${format}`}>
                                            Export as {format.toUpperCase()}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/documents/${document.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        {document.status === DocumentStatus.FAILED && (
                            <DropdownMenuItem>Retry Generation</DropdownMenuItem>
                        )}
                        {(document.status === DocumentStatus.PENDING ||
                            document.status === DocumentStatus.PROCESSING) && (
                                <DropdownMenuItem className="text-destructive">
                                    Cancel
                                </DropdownMenuItem>
                            )}
                        <DropdownMenuItem className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

// Helper function to get icon component
function getIconComponent(iconName: string) {
    const icons: Record<string, any> = {
        User: FileText,
        Scale: FileText,
        Briefcase: FileText,
        FileHeart: FileText,
        FileText: FileText,
    };
    return icons[iconName] || FileText;
}