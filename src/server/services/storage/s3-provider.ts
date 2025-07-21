// src/server/services/storage/s3-provider.ts

import type { StorageProvider } from "~/server/services/storage/types";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "~/env";

export class S3StorageProvider implements StorageProvider {
    private client: S3Client;
    private bucket: string;

    constructor(options?: { region?: string; bucket?: string }) {
        this.client = new S3Client({
            region: options?.region || env.AWS_REGION || "us-east-1",
            credentials: env.AWS_ACCESS_KEY_ID
                ? {
                    accessKeyId: env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                }
                : undefined,
        });

        this.bucket = options?.bucket || env.AWS_S3_BUCKET || "alleyoop-uploads";
    }

    async upload(data: Buffer, key: string): Promise<string> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: data,
            })
        );
        return key;
    }

    async download(key: string): Promise<Buffer> {
        const res = await this.client.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: key })
        );

        if (!res.Body) throw new Error("No body returned from S3");

        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as any) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    async delete(key: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
        );
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(
                new HeadObjectCommand({ Bucket: this.bucket, Key: key })
            );
            return true;
        } catch {
            return false;
        }
    }

    async getUrl(key: string): Promise<string> {
        return `https://${this.bucket}.s3.amazonaws.com/${key}`;
    }
} 