import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '~/env';

// Import workers
import './workers/document-generation';
import './workers/rag-processing';

// Initialize Redis connection
const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

// Export queues for use in API
export const documentQueue = new Queue('document-generation', {
    connection: redis,
});

export const ragQueue = new Queue('rag-processing', {
    connection: redis,
});

// Health check
export async function checkQueuesHealth() {
    try {
        await documentQueue.ping();
        await ragQueue.ping();
        return { healthy: true };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

console.log('[Queue] Workers initialized for document generation and RAG processing');