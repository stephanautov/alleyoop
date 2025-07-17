// src/server/services/storage/index.ts

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '~/env';
import { type PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export interface StorageProvider {
    upload(key: string, buffer: Buffer, metadata?: Record<string, any>): Promise<string>;
    download(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getUrl(key: string): Promise<string>;
}

export interface StorageConfig {
    documents: {
        provider: 'local' | 's3' | 'postgresql';
        config?: any;
    };
    cache: {
        provider: 'redis' | 'memory';
        config?: any;
    };
    progress: {
        provider: 'redis';
        config?: any;
    };
}

/**
 * Local filesystem storage provider
 */
export class LocalStorageProvider implements StorageProvider {
    private basePath: string;

    constructor(basePath?: string) {
        this.basePath = basePath || env.UPLOAD_DIR || './uploads';
    }

    async upload(key: string, buffer: Buffer, metadata?: Record<string, any>): Promise<string> {
        const filePath = path.join(this.basePath, key);
        const dir = path.dirname(filePath);

        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, buffer);

        // Write metadata if provided
        if (metadata) {
            await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2));
        }

        return key;
    }

    async download(key: string): Promise<Buffer> {
        const filePath = path.join(this.basePath, key);
        return await fs.readFile(filePath);
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.basePath, key);

        try {
            await fs.unlink(filePath);
            // Try to delete metadata file if exists
            await fs.unlink(`${filePath}.meta.json`).catch(() => { });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async exists(key: string): Promise<boolean> {
        const filePath = path.join(this.basePath, key);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async getUrl(key: string): Promise<string> {
        // For local storage, return a relative path
        return `/api/storage/local/${key}`;
    }
}

/**
 * S3 storage provider
 */
export class S3StorageProvider implements StorageProvider {
    private client: S3Client;
    private bucket: string;

    constructor(config?: { bucket?: string; region?: string }) {
        this.client = new S3Client({
            region: config?.region || env.AWS_REGION || 'us-east-1',
            credentials: env.AWS_ACCESS_KEY_ID ? {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            } : undefined,
        });
        this.bucket = config?.bucket || env.AWS_S3_BUCKET || 'docuforge-uploads';
    }

    async upload(key: string, buffer: Buffer, metadata?: Record<string, any>): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            Metadata: metadata,
        });

        await this.client.send(command);
        return key;
    }

    async download(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);
        const chunks: Uint8Array[] = [];

        for await (const chunk of response.Body as any) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    async delete(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(command);
    }

    async exists(key: string): Promise<boolean> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });

            await this.client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NoSuchKey') {
                return false;
            }
            throw error;
        }
    }

    async getUrl(key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        // Generate presigned URL valid for 1 hour
        return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    }
}

/**
 * PostgreSQL storage provider (using large objects)
 */
export class PostgreSQLStorageProvider implements StorageProvider {
    constructor(private db: PrismaClient) { }

    async upload(key: string, buffer: Buffer, metadata?: Record<string, any>): Promise<string> {
        // Store in a dedicated table
        const result = await this.db.$executeRaw`
      INSERT INTO storage_objects (key, data, metadata, created_at)
      VALUES (${key}, ${buffer}, ${metadata || {}}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING key;
    `;

        return key;
    }

    async download(key: string): Promise<Buffer> {
        const result = await this.db.$queryRaw<{ data: Buffer }[]>`
      SELECT data FROM storage_objects WHERE key = ${key};
    `;

        if (result.length === 0) {
            throw new Error(`Object not found: ${key}`);
        }

        return result[0].data;
    }

    async delete(key: string): Promise<void> {
        await this.db.$executeRaw`
      DELETE FROM storage_objects WHERE key = ${key};
    `;
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM storage_objects WHERE key = ${key}) as exists;
    `;

        return result[0]?.exists || false;
    }

    async getUrl(key: string): Promise<string> {
        // For PostgreSQL storage, return an API endpoint
        return `/api/storage/db/${key}`;
    }
}

/**
 * Storage manager that handles multiple providers
 */
export class UnifiedStorageManager {
    private providers: Map<string, StorageProvider> = new Map();
    private config: StorageConfig;
    private redis: Redis;

    constructor(
        private db: PrismaClient,
        config?: Partial<StorageConfig>
    ) {
        this.config = {
            documents: config?.documents || { provider: 'local' },
            cache: config?.cache || { provider: 'redis' },
            progress: config?.progress || { provider: 'redis' },
        };

        this.redis = new Redis(env.REDIS_URL);
        this.initializeProviders();
    }

    private initializeProviders() {
        // Document storage
        switch (this.config.documents.provider) {
            case 's3':
                this.providers.set('documents', new S3StorageProvider(this.config.documents.config));
                break;
            case 'postgresql':
                this.providers.set('documents', new PostgreSQLStorageProvider(this.db));
                break;
            default:
                this.providers.set('documents', new LocalStorageProvider());
        }
    }

    /**
     * Get storage provider for a specific type
     */
    getProvider(type: 'documents' | 'cache' | 'progress'): StorageProvider {
        if (type === 'cache' || type === 'progress') {
            // These are handled differently, not through StorageProvider interface
            throw new Error(`Use dedicated ${type} service instead`);
        }

        const provider = this.providers.get(type);
        if (!provider) {
            throw new Error(`Storage provider not found for type: ${type}`);
        }

        return provider;
    }

    /**
     * Upload a document with user preferences
     */
    async uploadDocument(
        userId: string,
        fileName: string,
        buffer: Buffer,
        metadata?: Record<string, any>
    ): Promise<string> {
        // Get user's storage preference
        const userPrefs = await this.db.userPreferences.findUnique({
            where: { userId },
            select: { preferredStorage: true },
        });

        const preferredStorage = userPrefs?.preferredStorage || this.config.documents.provider;

        // Override provider if user has preference
        let provider = this.providers.get('documents');
        if (preferredStorage !== this.config.documents.provider) {
            switch (preferredStorage) {
                case 's3':
                    provider = new S3StorageProvider();
                    break;
                case 'postgresql':
                    provider = new PostgreSQLStorageProvider(this.db);
                    break;
                default:
                    provider = new LocalStorageProvider();
            }
        }

        // Generate storage key
        const key = `${userId}/${Date.now()}-${fileName}`;

        // Upload using preferred provider
        await provider.upload(key, buffer, {
            ...metadata,
            userId,
            uploadedAt: new Date().toISOString(),
            storageProvider: preferredStorage,
        });

        return key;
    }

    /**
     * Get a document respecting user preferences
     */
    async getDocument(key: string, userId: string): Promise<Buffer> {
        // Check where the document is stored
        const source = await this.db.knowledgeSource.findFirst({
            where: {
                storageKey: key,
                userId,
            },
            select: {
                metadata: true,
            },
        });

        const storageProvider = source?.metadata?.['storageProvider'] || this.config.documents.provider;

        // Get appropriate provider
        let provider = this.providers.get('documents');
        if (storageProvider !== this.config.documents.provider) {
            switch (storageProvider) {
                case 's3':
                    provider = new S3StorageProvider();
                    break;
                case 'postgresql':
                    provider = new PostgreSQLStorageProvider(this.db);
                    break;
                default:
                    provider = new LocalStorageProvider();
            }
        }

        return await provider.download(key);
    }

    /**
     * Migrate documents between storage providers
     */
    async migrateStorage(
        userId: string,
        fromProvider: string,
        toProvider: string,
        progressCallback?: (progress: number) => void
    ): Promise<void> {
        // Get all documents for user
        const documents = await this.db.knowledgeSource.findMany({
            where: {
                userId,
                metadata: {
                    path: ['storageProvider'],
                    equals: fromProvider,
                },
            },
        });

        const total = documents.length;
        let processed = 0;

        // Create providers
        const from = this.createProvider(fromProvider);
        const to = this.createProvider(toProvider);

        for (const doc of documents) {
            try {
                // Download from old provider
                const buffer = await from.download(doc.storageKey);

                // Upload to new provider
                await to.upload(doc.storageKey, buffer, {
                    ...doc.metadata as any,
                    storageProvider: toProvider,
                    migratedAt: new Date().toISOString(),
                });

                // Update database
                await this.db.knowledgeSource.update({
                    where: { id: doc.id },
                    data: {
                        metadata: {
                            ...doc.metadata as any,
                            storageProvider: toProvider,
                            migratedAt: new Date().toISOString(),
                        },
                    },
                });

                // Delete from old provider
                await from.delete(doc.storageKey);

                processed++;
                progressCallback?.(Math.round((processed / total) * 100));
            } catch (error) {
                console.error(`Failed to migrate document ${doc.id}:`, error);
                // Continue with other documents
            }
        }

        // Update user preference
        await this.db.userPreferences.update({
            where: { userId },
            data: { preferredStorage: toProvider },
        });
    }

    private createProvider(type: string): StorageProvider {
        switch (type) {
            case 's3':
                return new S3StorageProvider();
            case 'postgresql':
                return new PostgreSQLStorageProvider(this.db);
            default:
                return new LocalStorageProvider();
        }
    }
}

// Export convenience function
export function createStorageManager(db: PrismaClient, config?: Partial<StorageConfig>) {
    return new UnifiedStorageManager(db, config);
}