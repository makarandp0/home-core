import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { getDb, documents } from '@home/db';

export interface DocumentStorageResult {
  id: string;
  filename: string;
  storagePath: string;
}

/**
 * Get the document storage path from environment variable.
 * Returns null if not configured.
 */
function getStoragePath(): string | null {
  return process.env.DOCUMENT_STORAGE_PATH || null;
}

/**
 * Extract mime type and base64 data from a data URL.
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}

/**
 * Get file extension from mime type.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return extensions[mimeType] || '';
}

/**
 * Store a document to disk and create a database entry.
 * Only call this on cache miss (new document).
 *
 * @param imageData - The base64 data URL of the document
 * @param originalFilename - The original filename (optional)
 * @param metadata - Optional metadata to store with the document
 * @returns DocumentStorageResult or null if storage is not configured
 */
export async function storeDocument(
  imageData: string,
  originalFilename?: string,
  metadata?: Record<string, unknown>
): Promise<DocumentStorageResult | null> {
  const storagePath = getStoragePath();
  if (!storagePath) {
    console.log('Document storage not configured (DOCUMENT_STORAGE_PATH not set)');
    return null;
  }

  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    console.error('Invalid data URL format');
    return null;
  }

  const { mimeType, base64Data } = parsed;
  const extension = getExtensionFromMimeType(mimeType);
  const uuid = randomUUID();
  const filename = `${uuid}${extension}`;
  const fullPath = join(storagePath, filename);

  try {
    // Ensure the storage directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    // Decode base64 and write to file
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(fullPath, buffer);

    // Calculate size
    const sizeBytes = buffer.length;

    // Create database entry
    const db = getDb();
    const [doc] = await db
      .insert(documents)
      .values({
        filename,
        originalFilename: originalFilename || filename,
        mimeType,
        sizeBytes,
        storagePath: fullPath,
        metadata: metadata || {},
      })
      .returning({ id: documents.id });

    console.log(`Document stored: ${filename} (${sizeBytes} bytes)`);

    return {
      id: doc.id,
      filename,
      storagePath: fullPath,
    };
  } catch (err) {
    console.error('Failed to store document:', err);
    return null;
  }
}
