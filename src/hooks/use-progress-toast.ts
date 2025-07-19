// src/hooks/use-progress-toast.ts

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSocket } from './use-socket';

export function useProgressToast(documentId: string, documentTitle: string) {
    const { socket, isConnected } = useSocket();
    const toastIdRef = useRef<string | number | null>(null);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleProgress = (data: any) => {
            if (data.documentId !== documentId) return;

            if (data.stage === 'complete') {
                // Dismiss progress toast
                if (toastIdRef.current) {
                    toast.dismiss(toastIdRef.current);
                }

                // Show success toast
                toast.success(`${documentTitle} generated successfully!`, {
                    duration: 5000,
                    action: {
                        label: 'View',
                        onClick: () => {
                            // Navigate to document
                            window.location.href = `/documents/${documentId}`;
                        },
                    },
                });
            } else if (data.stage === 'error') {
                // Dismiss progress toast
                if (toastIdRef.current) {
                    toast.dismiss(toastIdRef.current);
                }

                // Show error toast
                toast.error(`Failed to generate ${documentTitle}`, {
                    description: data.error,
                    duration: 0, // Don't auto-dismiss errors
                    action: {
                        label: 'Retry',
                        onClick: () => {
                            // Trigger retry
                            socket.emit('retry:document', documentId);
                        },
                    },
                });
            } else {
                // Update progress toast
                if (!toastIdRef.current) {
                    toastIdRef.current = toast.loading(`Generating ${documentTitle}...`, {
                        description: `${data.progress}% complete`,
                        duration: Infinity,
                    });
                } else {
                    toast.loading(`Generating ${documentTitle}...`, {
                        id: toastIdRef.current,
                        description: `${data.progress}% complete - ${data.message}`,
                        duration: Infinity,
                    });
                }
            }
        };

        socket.on('generation:progress', handleProgress);
        socket.on('generation:error', handleProgress);

        return () => {
            socket.off('generation:progress', handleProgress);
            socket.off('generation:error', handleProgress);

            // Clean up toast on unmount
            if (toastIdRef.current) {
                toast.dismiss(toastIdRef.current);
            }
        };
    }, [socket, isConnected, documentId, documentTitle]);
}