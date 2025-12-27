import type { FastifyPluginAsync } from 'fastify';
import {
  VisionRequestSchema,
  VisionExtractTextRequestSchema,
  VisionParseRequestSchema,
  DocumentDataSchema,
  type VisionResponse,
  type VisionExtractTextResponse,
  type VisionParseResponse,
  type ApiResponse,
  type DocumentData,
} from '@home/types';
import { getProviderById, Anthropic, OpenAI } from '../providers/index.js';
import { withAnalyzeCache, withExtractTextCache, withParseTextCache } from '../services/llm-cache.js';
import {
  storeDocument,
  updateDocumentMetadata,
  type DocumentMetadataUpdate,
} from '../services/document-storage.js';
import { getApiKeyForProvider } from '../services/settings-service.js';

/**
 * Build metadata update from LLM-extracted document data.
 * Maps top-level fields to database columns and stores the rest in JSONB.
 */
function buildMetadataUpdate(doc: DocumentData): DocumentMetadataUpdate {
  // Fields to store in top-level columns
  const update: DocumentMetadataUpdate = {
    documentType: doc.document_type,
    documentOwner: doc.name ?? undefined,
    expiryDate: doc.expiry_date ?? undefined,
    category: doc.category ?? undefined,
    issueDate: doc.issue_date ?? undefined,
    country: doc.country ?? undefined,
    // Convert number to string for numeric column precision
    amountValue: doc.amount?.value != null ? String(doc.amount.value) : undefined,
    amountCurrency: doc.amount?.currency ?? undefined,
  };

  // Fields to store in JSONB metadata column
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

export const visionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/vision', async (request, reply): Promise<ApiResponse<VisionResponse>> => {
    const parseResult = VisionRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      reply.code(400);
      return {
        ok: false,
        error: `Validation error: ${parseResult.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const { image, fileName, prompt, apiKey: requestApiKey, provider: providerId } = parseResult.data;

    const provider = getProviderById(providerId);
    if (!provider) {
      reply.code(400);
      return { ok: false, error: `Unknown provider: ${providerId}` };
    }

    const apiKey = requestApiKey || (await getApiKeyForProvider(providerId));
    if (!apiKey) {
      reply.code(400);
      return {
        ok: false,
        error: 'Provider not configured. Set API key in Settings.',
      };
    }

    try {
      const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const promptText = prompt ?? '';

      const { result, cached } = await withAnalyzeCache(
        providerId,
        imageData,
        promptText,
        () => provider.analyze(apiKey, imageData, promptText)
      );

      // Always store the uploaded document
      const stored = await storeDocument(imageData, fileName);
      const documentId = stored?.id ?? '';

      // Always return extractedText and response
      // Only include document if it validates correctly
      const documentResult = DocumentDataSchema.safeParse(result.document);

      // Update document with LLM-extracted metadata
      if (documentId && documentResult.success) {
        await updateDocumentMetadata(documentId, buildMetadataUpdate(documentResult.data));
      }

      const data: VisionResponse = {
        extractedText: result.extractedText,
        response: result.response,
        document: documentResult.success ? documentResult.data : undefined,
        usage: result.usage,
        cached,
        documentId,
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

      reply.code(500);
      return { ok: false, error: errorMessage };
    }
  });

  // Extract text from image using LLM vision (Step 2 - for low confidence OCR)
  app.post(
    '/vision/extract-text',
    async (request, reply): Promise<ApiResponse<VisionExtractTextResponse>> => {
      const parseResult = VisionExtractTextRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        reply.code(400);
        return {
          ok: false,
          error: `Validation error: ${parseResult.error.issues.map((e) => e.message).join(', ')}`,
        };
      }

      const { image, fileName, apiKey: requestApiKey, provider: providerId } = parseResult.data;

      const provider = getProviderById(providerId);
      if (!provider) {
        reply.code(400);
        return { ok: false, error: `Unknown provider: ${providerId}` };
      }

      const apiKey = requestApiKey || (await getApiKeyForProvider(providerId));
      if (!apiKey) {
        reply.code(400);
        return {
          ok: false,
          error: 'Provider not configured. Set API key in Settings.',
        };
      }

      try {
        const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

        const { result, cached } = await withExtractTextCache(
          providerId,
          imageData,
          () => provider.extractText(apiKey, imageData)
        );

        // Always store the uploaded document
        const stored = await storeDocument(imageData, fileName);
        const documentId = stored?.id ?? '';

        return { ok: true, data: { ...result, cached, documentId } };
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

        reply.code(500);
        return { ok: false, error: errorMessage };
      }
    }
  );

  // Parse text to JSON document (Step 3)
  app.post('/vision/parse', async (request, reply): Promise<ApiResponse<VisionParseResponse>> => {
    const parseResult = VisionParseRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      reply.code(400);
      return {
        ok: false,
        error: `Validation error: ${parseResult.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const { text, apiKey: requestApiKey, provider: providerId, prompt, documentId } = parseResult.data;

    const provider = getProviderById(providerId);
    if (!provider) {
      reply.code(400);
      return { ok: false, error: `Unknown provider: ${providerId}` };
    }

    const apiKey = requestApiKey || (await getApiKeyForProvider(providerId));
    if (!apiKey) {
      reply.code(400);
      return {
        ok: false,
        error: 'Provider not configured. Set API key in Settings.',
      };
    }

    try {
      const promptText = prompt ?? '';

      const { result, cached } = await withParseTextCache(
        providerId,
        text,
        promptText,
        () => provider.parseText(apiKey, text, promptText)
      );

      // Validate document if it exists
      const documentResult = result.document ? DocumentDataSchema.safeParse(result.document) : null;

      // Update document with LLM-extracted metadata if documentId provided
      if (documentId && documentResult?.success) {
        await updateDocumentMetadata(documentId, buildMetadataUpdate(documentResult.data));
      }

      const data: VisionParseResponse = {
        document: documentResult?.success ? documentResult.data : undefined,
        response: result.response,
        usage: result.usage,
        cached,
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

      reply.code(500);
      return { ok: false, error: errorMessage };
    }
  });
};
