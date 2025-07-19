// src/components/cache/cache-status.tsx

'use client';

import { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '~/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '~/components/ui/alert-dialog';
import { api } from '~/trpc/react';
import { DocumentType } from '@prisma/client';
import {
    Zap,
    TrendingUp,
    DollarSign,
    RefreshCw,
    Trash2,
    Info,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface CacheStatusProps {
    documentType?: DocumentType;
    showDetails?: boolean;
    className?: string;
}

export function CacheStatus({
    documentType,
    showDetails = true,
    className
}: CacheStatusProps) {
    const [clearingCache, setClearingCache] = useState(false);

    // Fetch cache statistics
    const { data: stats, isLoading, refetch } = api.cache.getUserStats.useQuery(
        undefined,
        {
            refetchInterval: 30000, // Refresh every 30 seconds
        }
    );

    // Check cache health
    const { data: health } = api.cache.health.useQuery(
        undefined,
        {
            refetchInterval: 60000, // Check every minute
        }
    );

    // Clear cache mutation
    const clearCache = api.cache.clearDocumentType.useMutation({
        onMutate: () => {
            setClearingCache(true);
        },
        onSuccess: (result) => {
            toast.success(`Cleared ${result.entriesCleared} cache entries`);
            refetch();
        },
        onError: () => {
            toast.error('Failed to clear cache');
        },
        onSettled: () => {
            setClearingCache(false);
        },
    });

    const handleClearCache = async () => {
        if (documentType) {
            await clearCache.mutateAsync({ documentType });
        }
    };

    if (isLoading) {
        return (
            <Card className={className}>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-muted rounded w-1/3"></div>
                        <div className="h-8 bg-muted rounded w-full"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const cacheRate = stats?.cacheRate || 0;
    const costSaved = stats?.costSaved || 0;
    const totalHits = stats?.totalHits || 0;

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Cache Status
                            {health?.healthy ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Cache service is healthy
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Cache service is unavailable
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Reduce generation time and costs with intelligent caching
                        </CardDescription>
                    </div>

                    {documentType && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={clearingCache}
                                >
                                    {clearingCache ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear Cache</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will clear all cached content for {documentType.replace('_', ' ')} documents.
                                        Future generations will take longer but use the latest templates and settings.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearCache}>
                                        Clear Cache
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Cache Hit Rate */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cache Hit Rate</span>
                        <span className="font-medium">{Math.round(cacheRate * 100)}%</span>
                    </div>
                    <Progress value={cacheRate * 100} className="h-2" />
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-xs">Total Hits</span>
                        </div>
                        <p className="text-2xl font-semibold">{totalHits}</p>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            <span className="text-xs">Cost Saved</span>
                        </div>
                        <p className="text-2xl font-semibold">
                            ${costSaved.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Recent Cache Hits */}
                {showDetails && stats?.recentHits && stats.recentHits.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            Recent Cache Hits
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Documents that were generated faster using cached content
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </h4>

                        <div className="space-y-1">
                            {stats.recentHits.slice(0, 3).map((hit) => (
                                <div
                                    key={hit.id}
                                    className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {hit.type}
                                        </Badge>
                                        <span className="text-muted-foreground">
                                            {hit.provider}/{hit.model}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {hit.lastHit && formatDistanceToNow(new Date(hit.lastHit), {
                                            addSuffix: true
                                        })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Cache Info */}
                <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                        Cached content expires based on document type. Medical reports are cached
                        for 1 hour, while biographies are cached for up to 7 days.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}