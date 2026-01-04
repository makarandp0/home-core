// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { getDb, documents, eq, and } from '@ohs/db';
import { parseDataUrl } from '../utils/data-url.js';
import { sanitizeFilename } from '../utils/string-sanitize.js';

export interface DocumentStorageResult {
  id: string;
  filename: string;
  storagePath: string;
}

export interface RawFileResult {
  filename: string;
  storagePath: string;
  sizeBytes: number;
}

/**
 * Get the document storage path from environment variable.
 * Returns null if not configured.
 */
function getStoragePath(): string | null {
  return process.env.DOCUMENT_STORAGE_PATH || null;
}

/**
 * Get file extension from mime type, with fallback to original filename extension.
 */
function getExtensionFromMimeType(mimeType: string, originalFilename?: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf',
  };
  const ext = extensions[mimeType];
  if (ext) return ext;
  // Fallback to original filename extension if mime type not mapped
  if (originalFilename) {
    const originalExt = extname(originalFilename).toLowerCase();
    if (originalExt) return originalExt;
  }
  return '';
}

/**
 * Store a raw file to disk without creating a database entry.
 * Useful for storing original/alternate versions of documents.
 *
 * @param imageData - The base64 data URL of the file
 * @param baseFilename - Base filename (without extension) to use
 * @param suffix - Suffix to add to filename (e.g., '_original')
 * @param originalFilename - Original filename to extract extension from as fallback
 * @returns RawFileResult or null if storage is not configured
 */
export async function storeRawFile(
  imageData: string,
  baseFilename: string,
  suffix: string,
  originalFilename?: string
): Promise<RawFileResult | null> {
  const storagePath = getStoragePath();
  if (!storagePath) {
    return null;
  }

  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    console.error('Invalid data URL format');
    return null;
  }

  const { mimeType, base64Data } = parsed;
  const extension = getExtensionFromMimeType(mimeType, originalFilename);
  const filename = `${baseFilename}${suffix}${extension}`;
  const fullPath = join(storagePath, filename);

  try {
    await mkdir(dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(base64Data, 'base64');
    await writeFile(fullPath, buffer);

    console.log(`Raw file stored: ${filename} (${buffer.length} bytes)`);

    return {
      filename,
      storagePath: fullPath,
      sizeBytes: buffer.length,
    };
  } catch (err) {
    console.error('Failed to store raw file:', err);
    return null;
  }
}

/**
 * Store a document to disk and create a database entry.
 * Only call this on cache miss (new document).
 *
 * @param imageData - The base64 data URL of the document
 * @param originalFilename - The original filename (optional)
 * @param metadata - Optional metadata to store with the document
 * @param options - Settings: baseUuid for consistent naming, suffix for filename, userId for ownership (required)
 * @returns DocumentStorageResult or null if storage is not configured
 */
export async function storeDocument(
  imageData: string,
  originalFilename: string,
  metadata?: Record<string, unknown>,
  options?: { baseUuid?: string; suffix?: string; userId: string }
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
  const extension = getExtensionFromMimeType(mimeType, originalFilename);
  const uuid = options?.baseUuid ?? randomUUID();
  const suffix = options?.suffix ?? '';
  const filename = `${uuid}${suffix}${extension}`;
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
    if (!options?.userId) {
      console.error('userId is required for document storage');
      return null;
    }

    const [doc] = await db
      .insert(documents)
      .values({
        filename,
        originalFilename: sanitizeFilename(originalFilename),
        mimeType,
        sizeBytes,
        storagePath: fullPath,
        metadata: metadata || {},
        userId: options.userId,
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

export interface DocumentMetadataUpdate {
  documentType?: string;
  documentOwner?: string;
  expiryDate?: string;
  // New fields
  category?: string;
  issueDate?: string;
  country?: string;
  amountValue?: string; // stored as string for numeric precision
  amountCurrency?: string;
  // Fields to store in JSONB metadata
  metadata?: Record<string, unknown>;
  // Thumbnail (base64 data URL)
  thumbnail?: string;
}

/**
 * Update document metadata after LLM parsing.
 *
 * @param documentId - The UUID of the document to update
 * @param metadataUpdate - The metadata fields to update
 * @returns true if update succeeded, false otherwise
 */
export async function updateDocumentMetadata(
  documentId: string,
  metadataUpdate: DocumentMetadataUpdate
): Promise<boolean> {
  try {
    const db = getDb();

    // Build update object with only defined fields
    const setValues: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (metadataUpdate.documentType !== undefined) setValues.documentType = metadataUpdate.documentType;
    if (metadataUpdate.documentOwner !== undefined) setValues.documentOwner = metadataUpdate.documentOwner;
    if (metadataUpdate.expiryDate !== undefined) setValues.expiryDate = metadataUpdate.expiryDate;
    if (metadataUpdate.category !== undefined) setValues.category = metadataUpdate.category;
    if (metadataUpdate.issueDate !== undefined) setValues.issueDate = metadataUpdate.issueDate;
    if (metadataUpdate.country !== undefined) setValues.country = metadataUpdate.country;
    if (metadataUpdate.amountValue !== undefined) setValues.amountValue = metadataUpdate.amountValue;
    if (metadataUpdate.amountCurrency !== undefined) setValues.amountCurrency = metadataUpdate.amountCurrency;
    if (metadataUpdate.metadata !== undefined) setValues.metadata = metadataUpdate.metadata;
    if (metadataUpdate.thumbnail !== undefined) setValues.thumbnail = metadataUpdate.thumbnail;

    await db.update(documents).set(setValues).where(eq(documents.id, documentId));

    console.log(`Document metadata updated: ${documentId}`);
    return true;
  } catch (err) {
    console.error('Failed to update document metadata:', err);
    return false;
  }
}

/**
 * Delete a document from disk and database.
 *
 * @param documentId - The UUID of the document to delete
 * @param userId - Optional user ID for authorization check (only delete if owned by this user)
 * @returns true if deletion succeeded, false otherwise
 */
export async function deleteDocument(documentId: string, userId?: string): Promise<boolean> {
  try {
    const db = getDb();

    // Build the where clause - include userId check if provided
    const whereConditions = userId
      ? and(eq(documents.id, documentId), eq(documents.userId, userId))
      : eq(documents.id, documentId);

    // First, get the storage path
    const [doc] = await db
      .select({ storagePath: documents.storagePath })
      .from(documents)
      .where(whereConditions)
      .limit(1);

    if (!doc) {
      console.error(`Document not found or not owned by user: ${documentId}`);
      return false;
    }

    // Delete the file from disk
    try {
      await unlink(doc.storagePath);
      console.log(`Document file deleted: ${doc.storagePath}`);
    } catch (err) {
      // Log but continue - file might already be deleted
      console.warn(`Could not delete file (may not exist): ${doc.storagePath}`, err);
    }

    // Delete from database
    await db.delete(documents).where(whereConditions);

    console.log(`Document deleted: ${documentId}`);
    return true;
  } catch (err) {
    console.error('Failed to delete document:', err);
    return false;
  }
}
