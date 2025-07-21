// src/server/services/storage/local-provider.ts

import { promises as fs } from "fs";
import path from "path";
import type { StorageProvider } from "~/server/services/storage/types";

const BASE_DIR = process.env.UPLOAD_DIR || "./uploads";

export class LocalStorageProvider implements StorageProvider {
    async upload(data: Buffer, key: string): Promise<string> {
        const fullPath = path.join(BASE_DIR, key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, data);
        return key;
    }

    async download(key: string): Promise<Buffer> {
        return await fs.readFile(path.join(BASE_DIR, key));
    }

    async delete(key: string): Promise<void> {
        try {
            await fs.unlink(path.join(BASE_DIR, key));
        } catch {
            /* ignore */
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            await fs.access(path.join(BASE_DIR, key));
            return true;
        } catch {
            return false;
        }
    }

    async getUrl(key: string): Promise<string> {
        return `/uploads/${key}`;
    }
} 