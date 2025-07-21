// src/server/services/storage/types.ts

export interface StorageProvider {
    /**
     * Upload a buffer to the given key. Should return the key that was written.
     */
    upload(data: Buffer, key: string): Promise<string>;

    /**
     * Download the file for the given key.
     */
    download(key: string): Promise<Buffer>;

    /**
     * Delete the file for the given key if it exists.
     */
    delete(key: string): Promise<void>;

    /**
     * Check whether a key exists.
     */
    exists(key: string): Promise<boolean>;

    /**
     * Get a public URL (or signed URL) that can be used to fetch the file.
     */
    getUrl(key: string): Promise<string>;
} 