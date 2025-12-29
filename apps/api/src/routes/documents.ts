import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  DocumentJsonMetadataSchema,
  DocumentUploadRequestSchema,
  DocumentDataSchema,
  ThumbnailsRequestSchema,
  IdParamsSchema,
  DocumentUpdateRequestSchema,
  type ApiResponse,
  type DocumentListResponse,
  type DocumentMetadata,
  type DocumentJsonMetadata,
  type DocumentUploadData,
  type DocumentUploadRequest,
  type DocumentData,
  type ExtractionMethod,
  type ThumbnailsRequest,
  type IdParams,
  type DocumentUpdateRequest,
} from '@home/types';
import { getDb, documents, desc, eq, inArray } from '@home/db';
import {
  storeDocument,
  storeRawFile,
  deleteDocument,
  updateDocumentMetadata,
  type DocumentMetadataUpdate,
} from '../services/document-storage.js';
import { getProviderById, Anthropic, OpenAI } from '../providers/index.js';
import { withExtractTextCache, withParseTextCache } from '../services/llm-cache.js';
import { getApiKeyForProvider, getActiveApiKey } from '../services/settings-service.js';
import { resizeImageIfNeeded } from '../services/image-resize.js';
import { generateThumbnail, generateThumbnailFromBytes } from '../services/thumbnail.js';
import { createRouteBuilder, notFound } from '../utils/route-builder.js';

/**
 * Safely parse JSONB metadata from database.
 * Returns null if parsing fails (defensive for legacy data).
 */
function parseMetadata(raw: unknown): DocumentJsonMetadata | null {
  const result = DocumentJsonMetadataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Build metadata update from LLM-extracted document data.
 * Maps top-level fields to database columns and stores the rest in JSONB.
 */
function buildMetadataUpdate(doc: DocumentData): DocumentMetadataUpdate {
  const update: DocumentMetadataUpdate = {
    documentType: doc.document_type,
    documentOwner: doc.name ?? undefined,
    expiryDate: doc.expiry_date ?? undefined,
    category: doc.category ?? undefined,
    issueDate: doc.issue_date ?? undefined,
    country: doc.country ?? undefined,
    amountValue: doc.amount?.value != null ? String(doc.amount.value) : undefined,
    amountCurrency: doc.amount?.currency ?? undefined,
  };

  const jsonbMetadata: Record<string, unknown> = {};

  if (doc.id) jsonbMetadata.id = doc.id;
  if (doc.reference_numbers?.length) jsonbMetadata.reference_numbers = doc.reference_numbers;
  if (doc.parties?.length) jsonbMetadata.parties = doc.parties;
  if (doc.date_of_birth) jsonbMetadata.date_of_birth = doc.date_of_birth;
  if (doc.issuing_authority) jsonbMetadata.issuing_authority = doc.issuing_authority;
  if (doc.state_province) jsonbMetadata.state_province = doc.state_province;
  if (doc.address) jsonbMetadata.address = doc.address;
  if (doc.language) jsonbMetadata.language = doc.language;
  if (doc.keywords?.length) jsonbMetadata.keywords = doc.keywords;
  if (doc.confidence) jsonbMetadata.confidence = doc.confidence;
  if (Object.keys(doc.fields).length) jsonbMetadata.fields = doc.fields;

  if (Object.keys(jsonbMetadata).length > 0) {
    update.metadata = jsonbMetadata;
  }

  return update;
}

/**
 * Check if a filename indicates an image file.
 */
function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dotIndex = lower.lastIndexOf('.');

  // Require a non-leading dot and a non-empty extension (e.g. "image.jpg", not "jpeg" or ".jpg" or "file.")
  if (dotIndex <= 0 || dotIndex === lower.length - 1) {
    return false;
  }

  const ext = lower.slice(dotIndex + 1);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext);
}

const DOC_PROCESSOR_URL = process.env.HOME_DOC_PROCESSOR_URL ?? 'http://localhost:8000';

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

interface PythonThumbnailResponse {
  ok: boolean;
  data?: {
    image: string; // base64 PNG
    width: number;
    height: number;
  };
  error?: string;
}

export const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  const routes = createRouteBuilder(fastify);

  /**
   * POST /api/documents/upload
   * Unified document upload: extracts text and parses to JSON in one call.
   * Handles both images (via LLM) and PDFs (via doc-processor).
   *
   * Note: This route uses raw Fastify due to complex provider-specific error handling.
   */
  fastify.post<{
    Body: DocumentUploadRequest;
    Reply: ApiResponse<DocumentUploadData>;
  }>('/documents/upload', async (request, reply) => {
    // Validate request
    const parsed = DocumentUploadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        ok: false,
        error: `Validation error: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const { file, filename, provider: requestedProvider } = parsed.data;

    // Get provider and API key (use active provider if not specified)
    let providerId: string;
    let apiKey: string;

    if (requestedProvider) {
      providerId = requestedProvider;
      const key = await getApiKeyForProvider(providerId);
      if (!key) {
        reply.code(400);
        return {
          ok: false,
          error: `Provider ${providerId} not configured. Set API key in Settings.`,
        };
      }
      apiKey = key;
    } else {
      const active = await getActiveApiKey();
      if (!active) {
        reply.code(400);
        return {
          ok: false,
          error: 'No active provider configured. Set up a provider in Settings.',
        };
      }
      providerId = active.providerType;
      apiKey = active.apiKey;
    }

    const provider = getProviderById(providerId);
    if (!provider) {
      reply.code(400);
      return { ok: false, error: `Unknown provider: ${providerId}` };
    }

    try {
      let extractedText: string;
      let extractionMethod: ExtractionMethod;
      let extractionConfidence: number | null = null;
      let documentId: string;
      let extractCached = false;
      let thumbnailDataUrl: string | null = null;

      // Step 1: Extract text based on file type
      if (isImageFile(filename)) {
        // For images: use LLM vision
        const originalImageData = file.startsWith('data:') ? file : `data:image/jpeg;base64,${file}`;

        // Resize to 3.5 MiB (binary) limit (~4.7 MiB base64) regardless of provider
        const resizeResult = await resizeImageIfNeeded(originalImageData);
        const imageData = resizeResult.imageData;

        // Generate a consistent UUID for file storage
        const docUuid = randomUUID();

        if (resizeResult.resized) {
          request.log.info({
            msg: 'Image resized for upload',
            originalSize: resizeResult.originalSize,
            finalSize: resizeResult.finalSize,
          });

          // Store both original and resized versions
          await storeRawFile(originalImageData, docUuid, '_original', filename);
          const stored = await storeDocument(imageData, filename, undefined, {
            baseUuid: docUuid,
            suffix: '_resized',
          });
          if (!stored) {
            reply.code(500);
            return { ok: false, error: 'Document storage is not configured on the server' };
          }
          documentId = stored.id;
        } else {
          // No resizing needed - store single copy without suffix
          const stored = await storeDocument(imageData, filename, undefined, {
            baseUuid: docUuid,
          });
          if (!stored) {
            reply.code(500);
            return { ok: false, error: 'Document storage is not configured on the server' };
          }
          documentId = stored.id;
        }

        // Generate thumbnail for image
        const thumbResult = await generateThumbnail(imageData);
        if (thumbResult) {
          thumbnailDataUrl = thumbResult.thumbnail;
          request.log.info({
            msg: 'Thumbnail generated',
            width: thumbResult.width,
            height: thumbResult.height,
            sizeBytes: thumbResult.sizeBytes,
          });
        }

        const { result, cached } = await withExtractTextCache(
          providerId,
          imageData,
          () => provider.extractText(apiKey, imageData)
        );

        extractedText = result.extractedText;
        extractionMethod = 'llm';
        extractCached = cached;
      } else {
        // For PDFs: use doc-processor
        const base64Content = file.startsWith('data:')
          ? file.replace(/^data:[^;]+;base64,/, '')
          : file;

        const response = await fetch(`${DOC_PROCESSOR_URL}/process/base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_data: base64Content,
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

        extractedText = result.data.text;
        extractionMethod = result.data.method;
        extractionConfidence = result.data.confidence ?? null;

        // Store the document
        const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64Content}`;
        const stored = await storeDocument(dataUrl, filename);
        if (!stored) {
          reply.code(500);
          return { ok: false, error: 'Document storage is not configured on the server' };
        }
        documentId = stored.id;

        // Generate thumbnail for PDF (call doc-processor for first page image)
        try {
          const thumbResponse = await fetch(`${DOC_PROCESSOR_URL}/thumbnail/base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_data: base64Content,
              size: 150,
            }),
          });

          if (thumbResponse.ok) {
            const thumbResult: PythonThumbnailResponse = await thumbResponse.json();
            if (thumbResult.ok && thumbResult.data) {
              // Convert PNG from doc-processor to optimized JPEG thumbnail
              const pngBuffer = Buffer.from(thumbResult.data.image, 'base64');
              const optimizedThumb = await generateThumbnailFromBytes(pngBuffer);
              if (optimizedThumb) {
                thumbnailDataUrl = optimizedThumb.thumbnail;
                request.log.info({
                  msg: 'PDF thumbnail generated',
                  width: optimizedThumb.width,
                  height: optimizedThumb.height,
                  sizeBytes: optimizedThumb.sizeBytes,
                });
              }
            }
          }
        } catch (thumbErr) {
          // Thumbnail generation is non-critical, log and continue
          request.log.warn({ msg: 'Failed to generate PDF thumbnail', error: thumbErr });
        }
      }

      // Step 2: Parse text to JSON
      const { result: parseResult, cached: parseCached } = await withParseTextCache(
        providerId,
        extractedText,
        '',
        () => provider.parseText(apiKey, extractedText, '')
      );

      // Validate document if it exists
      const documentResult = parseResult.document
        ? DocumentDataSchema.safeParse(parseResult.document)
        : null;

      // Update document with LLM-extracted metadata and thumbnail
      if (documentId) {
        const metadataUpdate = documentResult?.success
          ? buildMetadataUpdate(documentResult.data)
          : {};

        // Add thumbnail to dedicated column if generated
        if (thumbnailDataUrl) {
          metadataUpdate.thumbnail = thumbnailDataUrl;
        }

        // Only update if we have something to update
        if (Object.keys(metadataUpdate).length > 0) {
          await updateDocumentMetadata(documentId, metadataUpdate);
        }
      }

      const data: DocumentUploadData = {
        documentId,
        extractedText,
        extractionMethod,
        extractionConfidence,
        document: documentResult?.success ? documentResult.data : undefined,
        response: parseResult.response,
        usage: parseResult.usage,
        cached: extractCached && parseCached,
      };

      return { ok: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

      if (err instanceof OpenAI.APIError) {
        reply.code(err.status ?? 500);
        return { ok: false, error: `OpenAI API error: ${err.message}` };
      }

      if (err instanceof Anthropic.APIError) {
        reply.code(err.status ?? 500);
        return { ok: false, error: `Anthropic API error: ${err.message}` };
      }

      // Check if it's a connection error
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        reply.code(503);
        return { ok: false, error: 'Doc processor service unavailable' };
      }

      reply.code(500);
      return { ok: false, error: errorMessage };
    }
  });

  /**
   * GET /api/documents/health
   * Check the health of the doc-processor service.
   */
  routes.get<unknown, unknown, unknown, { available: boolean; url: string }>({
    url: '/documents/health',
    handler: async () => {
      try {
        const response = await fetch(`${DOC_PROCESSOR_URL}/health`, {
          method: 'GET',
        });

        return { available: response.ok, url: DOC_PROCESSOR_URL };
      } catch {
        return { available: false, url: DOC_PROCESSOR_URL };
      }
    },
  });

  /**
   * POST /api/documents/thumbnails
   * Get thumbnails for multiple documents (for lazy loading).
   * Returns a map of document ID to thumbnail data URL.
   */
  routes.post<ThumbnailsRequest, unknown, unknown, Record<string, string | null>>({
    url: '/documents/thumbnails',
    schema: { body: ThumbnailsRequestSchema },
    handler: async ({ body }) => {
      const db = getDb();
      const docs = await db
        .select({
          id: documents.id,
          thumbnail: documents.thumbnail,
        })
        .from(documents)
        .where(inArray(documents.id, body.ids));

      // Build map of id -> thumbnail
      const thumbnailMap: Record<string, string | null> = {};
      for (const doc of docs) {
        thumbnailMap[doc.id] = doc.thumbnail;
      }

      return thumbnailMap;
    },
  });

  /**
   * GET /api/documents
   * List all stored documents with metadata.
   * Returns all fields needed for client-side filtering/search.
   */
  routes.get<unknown, unknown, unknown, DocumentListResponse>({
    url: '/documents',
    handler: async () => {
      const db = getDb();
      const docs = await db
        .select({
          id: documents.id,
          filename: documents.filename,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          // Core fields
          documentType: documents.documentType,
          documentOwner: documents.documentOwner,
          expiryDate: documents.expiryDate,
          // New searchable fields
          category: documents.category,
          issueDate: documents.issueDate,
          country: documents.country,
          amountValue: documents.amountValue,
          amountCurrency: documents.amountCurrency,
          // JSONB metadata (contains keywords, parties, etc.)
          metadata: documents.metadata,
          // Timestamps
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .orderBy(desc(documents.createdAt));

      // Parse metadata from JSONB to typed structure
      const typedDocs = docs.map((doc) => ({
        ...doc,
        metadata: parseMetadata(doc.metadata),
      }));

      return {
        documents: typedDocs,
        total: typedDocs.length,
      };
    },
  });

  /**
   * GET /api/documents/:id
   * Get document metadata by ID.
   */
  routes.get<unknown, IdParams, unknown, DocumentMetadata>({
    url: '/documents/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params }) => {
      const db = getDb();
      const [doc] = await db
        .select({
          id: documents.id,
          filename: documents.filename,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          // Core fields
          documentType: documents.documentType,
          documentOwner: documents.documentOwner,
          expiryDate: documents.expiryDate,
          // New searchable fields
          category: documents.category,
          issueDate: documents.issueDate,
          country: documents.country,
          amountValue: documents.amountValue,
          amountCurrency: documents.amountCurrency,
          // JSONB metadata
          metadata: documents.metadata,
          // Timestamps
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.id, params.id))
        .limit(1);

      if (!doc) {
        notFound('Document not found');
      }

      // Parse metadata from JSONB to typed structure
      return {
        ...doc,
        metadata: parseMetadata(doc.metadata),
      };
    },
  });

  /**
   * GET /api/documents/:id/file
   * Serve the actual document file.
   *
   * Note: This route uses raw Fastify due to file streaming requirements.
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
  routes.delete<unknown, IdParams, unknown, { deleted: boolean }>({
    url: '/documents/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params }) => {
      const success = await deleteDocument(params.id);

      if (!success) {
        notFound('Document not found or could not be deleted');
      }

      return { deleted: true };
    },
  });

  /**
   * PATCH /api/documents/:id
   * Update document metadata (partial update).
   */
  routes.patch<DocumentUpdateRequest, IdParams, unknown, DocumentMetadata>({
    url: '/documents/:id',
    schema: {
      body: DocumentUpdateRequestSchema,
      params: IdParamsSchema,
    },
    handler: async ({ params, body }) => {
      const db = getDb();

      // First verify document exists
      const [existing] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, params.id))
        .limit(1);

      if (!existing) {
        notFound('Document not found');
      }

      // Build update object
      const updateFields: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (body.originalFilename !== undefined) {
        updateFields.originalFilename = body.originalFilename;
      }
      if (body.documentOwner !== undefined) {
        updateFields.documentOwner = body.documentOwner;
      }
      if (body.documentType !== undefined) {
        updateFields.documentType = body.documentType;
      }
      if (body.category !== undefined) {
        updateFields.category = body.category;
      }

      // Apply updates
      await db
        .update(documents)
        .set(updateFields)
        .where(eq(documents.id, params.id));

      // Return updated document
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
          category: documents.category,
          issueDate: documents.issueDate,
          country: documents.country,
          amountValue: documents.amountValue,
          amountCurrency: documents.amountCurrency,
          metadata: documents.metadata,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.id, params.id))
        .limit(1);

      return {
        ...doc,
        metadata: parseMetadata(doc.metadata),
      };
    },
  });
};
