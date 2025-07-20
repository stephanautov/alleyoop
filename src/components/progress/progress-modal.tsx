"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2,
    CheckCircle,
    XCircle,
    FileText,
    Brain,
    Sparkles,
    Clock,
    AlertCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface ProgressData {
    stage: 'initializing' | 'outline' | 'sections' | 'refinement' | 'complete' | 'error';
    progress: number;
    message: string;
    currentSection?: string;
    estimatedTimeRemaining?: number;
    metadata?: {
        sectionsCompleted?: number;
        totalSections?: number;
        tokensUsed?: number;
        costSoFar?: number;
        ragSourcesUsed?: number;
    };
}

interface ProgressModalProps {
    documentId: string;
    onComplete: () => void;
    onError: (error: string) => void;
}

export function ProgressModal({ documentId, onComplete, onError }: ProgressModalProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [progressData, setProgressData] = useState<ProgressData>({
        stage: 'initializing',
        progress: 0,
        message: 'Preparing document generation...',
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize Socket.IO connection
        const newSocket = io({
            path: '/api/socket',
        });

        setSocket(newSocket);

        // Join document room
        newSocket.emit('join-document', documentId);

        // Listen for progress updates
        newSocket.on('generation:progress', (data: ProgressData) => {
            setProgressData(data);

            if (data.stage === 'complete') {
                setTimeout(onComplete, 1500); // Delay to show completion
            }
        });

        // Listen for errors
        newSocket.on('generation:error', (errorData: { message: string }) => {
            setError(errorData.message);
            setProgressData(prev => ({ ...prev, stage: 'error' }));
            onError(errorData.message);
        });

        // RAG context updates
        newSocket.on('rag:context', (data: any) => {
            setProgressData(prev => ({
                ...prev,
                metadata: {
                    ...prev.metadata,
                    ragSourcesUsed: data.sourceCount,
                },
            }));
        });

        return () => {
            newSocket.emit('leave-document', documentId);
            newSocket.disconnect();
        };
    }, [documentId, onComplete, onError]);

    const getStageIcon = () => {
        switch (progressData.stage) {
            case 'initializing':
                return <FileText className="h-6 w-6" />;
            case 'outline':
                return <Brain className="h-6 w-6" />;
            case 'sections':
                return <FileText className="h-6 w-6" />;
            case 'refinement':
                return <Sparkles className="h-6 w-6" />;
            case 'complete':
                return <CheckCircle className="h-6 w-6" />;
            case 'error':
                return <XCircle className="h-6 w-6" />;
            default:
                return <Loader2 className="h-6 w-6 animate-spin" />;
        }
    };

    const getStageColor = () => {
        switch (progressData.stage) {
            case 'complete':
                return 'text-green-600';
            case 'error':
                return 'text-red-600';
            default:
                return 'text-blue-600';
        }
    };

    const stages = [
        { id: 'initializing', label: 'Initializing', progress: 5 },
        { id: 'outline', label: 'Creating Outline', progress: 25 },
        { id: 'sections', label: 'Writing Sections', progress: 75 },
        { id: 'refinement', label: 'Polishing', progress: 95 },
        { id: 'complete', label: 'Complete', progress: 100 },
    ];

    const currentStageIndex = stages.findIndex(s => s.id === progressData.stage);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full mx-4"
            >
                {/* Header */}
                <div className="flex items-center justify-center mb-6">
                    <div className={`${getStageColor()}`}>
                        {getStageIcon()}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 ml-3">
                        {error ? 'Generation Failed' : 'Generating Your Document'}
                    </h2>
                </div>

                {/* Main Progress */}
                {!error && (
                    <>
                        {/* Progress Bar */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>{progressData.message}</span>
                                <span>{Math.round(progressData.progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <motion.div
                                    className="bg-blue-500 h-3 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressData.progress}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>

                        {/* Stage Indicators */}
                        <div className="flex justify-between mb-6">
                            {stages.map((stage, idx) => (
                                <div key={stage.id} className="flex-1 flex items-center">
                                    <div className="flex flex-col items-center flex-1">
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${idx <= currentStageIndex
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 text-gray-500'
                                                }`}
                                        >
                                            {idx < currentStageIndex ? '✓' : idx + 1}
                                        </div>
                                        <span className={`text-xs mt-1 ${idx <= currentStageIndex ? 'text-gray-900' : 'text-gray-500'
                                            }`}>
                                            {stage.label}
                                        </span>
                                    </div>
                                    {idx < stages.length - 1 && (
                                        <div className={`flex-1 h-0.5 -mt-4 ${idx < currentStageIndex ? 'bg-blue-500' : 'bg-gray-200'
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Additional Info */}
                        <div className="space-y-3">
                            {/* Current Section */}
                            {progressData.currentSection && (
                                <div className="flex items-center text-sm text-gray-600">
                                    <FileText className="h-4 w-4 mr-2" />
                                    <span>Writing: {progressData.currentSection}</span>
                                </div>
                            )}

                            {/* Time Remaining */}
                            {progressData.estimatedTimeRemaining && (
                                <div className="flex items-center text-sm text-gray-600">
                                    <Clock className="h-4 w-4 mr-2" />
                                    <span>
                                        Estimated time remaining: {Math.ceil(progressData.estimatedTimeRemaining / 60)} minutes
                                    </span>
                                </div>
                            )}

                            {/* Metadata Grid */}
                            {progressData.metadata && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    {progressData.metadata.sectionsCompleted !== undefined && (
                                        <div className="text-sm">
                                            <span className="text-gray-500">Sections:</span>
                                            <span className="ml-2 font-medium">
                                                {progressData.metadata.sectionsCompleted} / {progressData.metadata.totalSections}
                                            </span>
                                        </div>
                                    )}

                                    {progressData.metadata.tokensUsed !== undefined && (
                                        <div className="text-sm">
                                            <span className="text-gray-500">Tokens Used:</span>
                                            <span className="ml-2 font-medium">
                                                {progressData.metadata.tokensUsed.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {progressData.metadata.costSoFar !== undefined && (
                                        <div className="text-sm">
                                            <span className="text-gray-500">Cost So Far:</span>
                                            <span className="ml-2 font-medium text-green-600">
                                                ${progressData.metadata.costSoFar.toFixed(3)}
                                            </span>
                                        </div>
                                    )}

                                    {progressData.metadata.ragSourcesUsed !== undefined && (
                                        <div className="text-sm">
                                            <span className="text-gray-500">RAG Sources:</span>
                                            <span className="ml-2 font-medium text-blue-600">
                                                {progressData.metadata.ragSourcesUsed} used
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tips */}
                        <AnimatePresence mode="wait">
                            {progressData.stage === 'sections' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="mt-6 p-4 bg-blue-50 rounded-lg"
                                >
                                    <div className="flex items-start space-x-2">
                                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                                        <div className="text-sm text-blue-900">
                                            <p className="font-medium">Did you know?</p>
                                            <p className="mt-1">
                                                Documents with RAG enhancement typically contain 30-50% more relevant information
                                                and are more accurate to your specific context.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-4">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Success State */}
                {progressData.stage === 'complete' && !error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-4"
                    >
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                            Document Generated Successfully!
                        </p>
                        <p className="text-sm text-gray-600">
                            Redirecting to your document...
                        </p>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}