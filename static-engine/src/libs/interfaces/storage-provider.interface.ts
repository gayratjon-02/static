/**
 * Storage provider interface.
 * All storage implementations (local disk, S3, Supabase Storage, R2)
 * must implement this contract so they can be swapped via DI.
 */
export interface IStorageProvider {
    /**
     * Upload a file buffer to storage.
     * @param file      Raw file data
     * @param key       Storage key / path (e.g. "concepts/uuid.png")
     * @param contentType  MIME type (e.g. "image/png")
     * @returns Public URL of the uploaded file
     */
    upload(file: Buffer, key: string, contentType: string): Promise<string>;

    /**
     * Delete a file from storage.
     * @param key Storage key / path
     */
    delete(key: string): Promise<void>;

    /**
     * Get the public URL for a given storage key.
     * @param key Storage key / path
     */
    getUrl(key: string): string;
}

/** DI token for injecting the storage provider */
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
