// src/components/documents/generation-progress.tsx

import { useEffect, useState } from 'react';
import { Progress } from '~/components/ui/progress';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    RefreshCw,
    Clock,
    FileText,
    Sparkles,
    Edit3
} from 'lucide-react';
import { useSocket } from '~/hooks/use-socket';
import { api } from '~/trpc/react';
import { cn } from '~/lib/utils';
import type { ProgressData } from '~/server/services/progress/storage';

interface GenerationProgressProps {
    documentId: string;
    onComplete?: () => void;
    className?: string;
}

const stageInfo = {
    outline: {
        label: 'Creating Outline',
        icon: FileText,
        color: 'text-blue-500',
    },
    sections: {
        label: 'Writing Sections',
        icon: Edit3,
        color: 'text-purple-500',
    },
    refinement: {
        label: 'Refining Content',
        icon: Sparkles,
        color: 'text-green-500',
    },
    complete: {
        label: 'Completed',
        icon: CheckCircle2,
        color: 'text-green-600',
    },
    error: {
        label: 'Failed',
        icon: AlertCircle,
        color: 'text-red-500',
    },
};

export function GenerationProgress({
    documentId,
    onComplete,
    className
}: GenerationProgressProps) {
    const { socket, isConnected, connectionError } = useSocket();
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);

    const retryMutation = api.document.retry.useMutation();

    useEffect(() => {
        if (!socket || !isConnected) return;

        // Subscribe to document progress
        socket.emit('subscribe:document', documentId);

        // Listen for progress updates
        const handleProgress = (data: ProgressData) => {
            if (data.documentId === documentId) {
                setProgress(data);

                if (data.stage === 'complete') {
                    setShowCompletion(true);
                    onComplete?.();

                    // Hide completion message after 5 seconds
                    setTimeout(() => {
                        setShowCompletion(false);
                    }, 5000);
                }
            }
        };

        const handleError = (data: { documentId: string; error: string; canRetry: boolean }) => {
            if (data.documentId === documentId) {
                setProgress(prev => ({
                    ...prev!,
                    stage: 'error',
                    error: data.error,
                    canRetry: data.canRetry,
                    updatedAt: Date.now(),
                }));
            }
        };

        socket.on('generation:progress', handleProgress);
        socket.on('generation:error', handleError);

        return () => {
            socket.emit('unsubscribe:document', documentId);
            socket.off('generation:progress', handleProgress);
            socket.off('generation:error', handleError);
        };
    }, [socket, isConnected, documentId, onComplete]);

    if (connectionError) {
        return (
            <Alert variant="destructive" className={className}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Connection error: {connectionError}
                </AlertDescription>
            </Alert>
        );
    }

    if (!progress || progress.stage === 'complete' && !showCompletion) {
        return null;
    }

    const stage = stageInfo[progress.stage];
    const Icon = stage.icon;

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const handleRetry = async () => {
        try {
            await retryMutation.mutateAsync({ documentId });
        } catch (error) {
            console.error('Retry failed:', error);
        }
    };

    return (
        <Card className={cn('w-full', className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className={cn('h-5 w-5', stage.color)} />
                        <h3 className="font-semibold">{stage.label}</h3>
                        {!isConnected && (
                            <Badge variant="secondary" className="ml-2">
                                Reconnecting...
                            </Badge>
                        )}
                    </div>
                    {progress.estimatedTimeRemaining && progress.stage !== 'complete' && progress.stage !== 'error' && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(progress.estimatedTimeRemaining)} remaining</span>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {progress.stage !== 'error' ? (
                    <>
                        <div className="space-y-2">
                            <Progress
                                value={progress.progress}
                                className="h-2"
                                indicatorClassName={cn(
                                    'transition-all duration-500',
                                    progress.stage === 'complete' && 'bg-green-500'
                                )}
                            />
                            <p className="text-sm text-muted-foreground">
                                {progress.message}
                            </p>
                        </div>

                        {progress.currentSection && (
                            <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full justify-between">
                                        <span>View Details</span>
                                        <ChevronDown className={cn(
                                            'h-4 w-4 transition-transform',
                                            isDetailsOpen && 'rotate-180'
                                        )} />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                    <div className="rounded-md bg-muted p-3">
                                        <p className="text-sm">
                                            <span className="font-medium">Current Section:</span>{' '}
                                            {progress.currentSection}
                                        </p>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </>
                ) : (
                    <div className="space-y-3">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{progress.error}</AlertDescription>
                        </Alert>

                        {progress.canRetry && (
                            <Button
                                onClick={handleRetry}
                                disabled={retryMutation.isPending}
                                className="w-full"
                                variant="outline"
                            >
                                {retryMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Retry Generation
                            </Button>
                        )}
                    </div>
                )}

                {progress.stage === 'complete' && showCompletion && (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            Document generated successfully!
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}