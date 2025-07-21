"use client";

// src/components/documents/generation-progress-mobile.tsx

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { ChevronUp, X } from 'lucide-react';
import { GenerationProgress } from './generation-progress';
import { cn } from '~/lib/utils';

interface MobileProgressIndicatorProps {
    documentId: string;
    documentTitle: string;
}

export function MobileProgressIndicator({
    documentId,
    documentTitle
}: MobileProgressIndicatorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Listen for progress updates
    useEffect(() => {
        // Implementation would connect to the same socket events
        // For brevity, showing the UI structure
    }, [documentId]);

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-50 lg:hidden">
                <Button
                    size="sm"
                    onClick={() => setIsMinimized(false)}
                    className="rounded-full shadow-lg"
                >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    {progress}%
                </Button>
            </div>
        );
    }

    return (
        <>
            {/* Mobile floating indicator */}
            <div className="fixed bottom-4 right-4 z-40 lg:hidden">
                <div className="bg-background border rounded-lg shadow-lg p-3 max-w-xs">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium truncate flex-1 mr-2">
                            {documentTitle}
                        </h4>
                        <div className="flex gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setIsMinimized(true)}
                            >
                                <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setIsOpen(true)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">
                        Generating document...
                    </p>
                </div>
            </div>

            {/* Full progress sheet for mobile */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                    <SheetHeader>
                        <SheetTitle>Document Generation Progress</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                        <GenerationProgress
                            documentId={documentId}
                            onComplete={() => setIsOpen(false)}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}