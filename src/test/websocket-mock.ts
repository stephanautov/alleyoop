// src/test/websocket-mock.ts

import { EventEmitter } from 'events';

export class MockSocket extends EventEmitter {
    connected = true;

    connect() {
        this.connected = true;
        this.emit('connect');
    }

    disconnect() {
        this.connected = false;
        this.emit('disconnect', 'manual');
    }

    emit(event: string, ...args: any[]) {
        super.emit(event, ...args);
        return this;
    }
}

export function createMockSocket() {
    return new MockSocket();
}

// Mock progress data generator
export function generateMockProgress(documentId: string, stage: string, progress: number) {
    return {
        documentId,
        stage,
        progress,
        message: `${stage} in progress...`,
        currentSection: stage === 'sections' ? 'Introduction' : undefined,
        estimatedTimeRemaining: Math.max(0, (100 - progress) * 2),
        updatedAt: Date.now(),
        startedAt: Date.now() - (progress * 1000),
    };
}