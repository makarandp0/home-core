import type { FastifyPluginAsync } from 'fastify';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  DocumentProcessRequestSchema,
  DocumentProcessResponseSchema,
  type ApiResponse,
  type DocumentProcessData,
  type DocumentListResponse,
  type DocumentMetadata,
} from '@home/types';
import { getDb, documents, desc, eq } from '@home/db';
import { storeDocument, deleteDocument } from '../services/document-storage.js';

const DOC_PROCESSOR_URL = process.env.DOC_PROCESSOR_URL ?? 'http://localhost:8000';

interface PythonServiceResponse {
  ok: boolean;
  data?: {
    text: string;
    page_count: number;
    method: 'native' | 'ocr';
    confidence?: number;
  };
  error?: string;
}

export const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/documents/process
   * Process a document (PDF or image) and extract text.
   * Forwards the request to the Python doc-processor service.
   */
  fastify.post<{
    Body: { file: string; filename: string };
    Reply: ApiResponse<DocumentProcessData>;
  }>('/documents/process', async (request, reply) => {
    // Validate request body
    const parsed = DocumentProcessRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { ok: false, error: 'Invalid request: file and filename are required' };
    }

    const { file, filename } = parsed.data;

    try {
      // Forward to Python service
      const response = await fetch(`${DOC_PROCESSOR_URL}/process/base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_data: file,
          filename: filename,
        }),
      });

      if (!response.ok) {
        reply.code(response.status);
        return { ok: false, error: `Doc processor error: ${response.statusText}` };
      }

      const result: PythonServiceResponse = await response.json();

      if (!result.ok || !result.data) {
        reply.code(400);
        return { ok: false, error: result.error ?? 'Processing failed' };
      }

      // Store the document
      const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png';
      const dataUrl = `data:${mimeType};base64,${file}`;
      const stored = await storeDocument(dataUrl, filename);

      // Build and validate response
      const processedData: DocumentProcessData = {
        text: result.data.text,
        pageCount: result.data.page_count,
        method: result.data.method,
        confidence: result.data.confidence,
        documentId: stored?.id ?? '',
      };

      const validated = DocumentProcessResponseSchema.safeParse({
        ok: true,
        data: processedData,
      });

      if (!validated.success) {
        console.error('Doc processor validation failed:', validated.error.issues);
        reply.code(500);
        return {
          ok: false,
          error: `Invalid response from doc processor: ${validated.error.issues.map((i) => i.message).join(', ')}`,
        };
      }

      return { ok: true, data: processedData };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Check if it's a connection error
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        reply.code(503);
        return { ok: false, error: 'Doc processor service unavailable' };
      }

      reply.code(500);
      return { ok: false, error: `Document processing failed: ${errorMessage}` };
    }
  });

  /**
   * GET /api/documents/health
   * Check the health of the doc-processor service.
   */
  fastify.get<{
    Reply: ApiResponse<{ available: boolean; url: string }>;
  }>('/documents/health', async () => {
    try {
      const response = await fetch(`${DOC_PROCESSOR_URL}/health`, {
        method: 'GET',
      });

      if (response.ok) {
        return { ok: true, data: { available: true, url: DOC_PROCESSOR_URL } };
      }

      return { ok: true, data: { available: false, url: DOC_PROCESSOR_URL } };
    } catch {
      return { ok: true, data: { available: false, url: DOC_PROCESSOR_URL } };
    }
  });

  /**
   * GET /api/documents
   * List all stored documents with metadata.
   */
  fastify.get<{
    Reply: ApiResponse<DocumentListResponse>;
  }>('/documents', async (request, reply) => {
    try {
      const db = getDb();
      const docs = await db
        .select({
          id: documents.id,
          filename: documents.filename,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          documentType: documents.documentType,
          documentOwner: documents.documentOwner,
          expiryDate: documents.expiryDate,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .orderBy(desc(documents.createdAt));

      return {
        ok: true,
        data: {
          documents: docs,
          total: docs.length,
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      reply.code(500);
      return { ok: false, error: `Failed to list documents: ${errorMessage}` };
    }
  });

  /**
   * GET /api/documents/:id
   * Get document metadata by ID.
   */
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<DocumentMetadata>;
  }>('/documents/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const db = getDb();
      const [doc] = await db
        .select({
          id: documents.id,
          filename: documents.filename,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          documentType: documents.documentType,
          documentOwner: documents.documentOwner,
          expiryDate: documents.expiryDate,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);

      if (!doc) {
        reply.code(404);
        return { ok: false, error: 'Document not found' };
      }

      return { ok: true, data: doc };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      reply.code(500);
      return { ok: false, error: `Failed to get document: ${errorMessage}` };
    }
  });

  /**
   * GET /api/documents/:id/file
   * Serve the actual document file.
   */
  fastify.get<{
    Params: { id: string };
  }>('/documents/:id/file', async (request, reply) => {
    const { id } = request.params;

    try {
      const db = getDb();
      const [doc] = await db
        .select({
          storagePath: documents.storagePath,
          mimeType: documents.mimeType,
          originalFilename: documents.originalFilename,
        })
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);

      if (!doc) {
        reply.code(404);
        return { ok: false, error: 'Document not found' };
      }

      // Check if file exists
      try {
        await stat(doc.storagePath);
      } catch {
        reply.code(404);
        return { ok: false, error: 'Document file not found on disk' };
      }

      // Stream the file
      const stream = createReadStream(doc.storagePath);
      reply.header('Content-Type', doc.mimeType);
      reply.header('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
      return reply.send(stream);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      reply.code(500);
      return { ok: false, error: `Failed to serve document: ${errorMessage}` };
    }
  });

  /**
   * DELETE /api/documents/:id
   * Delete a document by ID (removes both file and database entry).
   */
  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse<{ deleted: boolean }>;
  }>('/documents/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const success = await deleteDocument(id);

      if (!success) {
        reply.code(404);
        return { ok: false, error: 'Document not found or could not be deleted' };
      }

      return { ok: true, data: { deleted: true } };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      reply.code(500);
      return { ok: false, error: `Failed to delete document: ${errorMessage}` };
    }
  });
};
