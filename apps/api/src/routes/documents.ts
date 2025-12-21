import type { FastifyPluginAsync } from 'fastify';
import {
  DocumentProcessRequestSchema,
  DocumentProcessResponseSchema,
  type ApiResponse,
  type DocumentProcessData,
} from '@home/types';

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

      // Validate and transform response
      const processedData: DocumentProcessData = {
        text: result.data.text,
        pageCount: result.data.page_count,
        method: result.data.method,
        confidence: result.data.confidence,
      };

      const validated = DocumentProcessResponseSchema.safeParse({
        ok: true,
        data: processedData,
      });

      if (!validated.success) {
        reply.code(500);
        return { ok: false, error: 'Invalid response from doc processor' };
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
};
