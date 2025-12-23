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
} from '@home/types';
import { getProviderById, Anthropic, OpenAI } from '../providers/index.js';
import { withCache } from '../services/llm-cache.js';

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

    const { image, prompt, apiKey: requestApiKey, provider: providerId } = parseResult.data;

    const provider = getProviderById(providerId);
    if (!provider) {
      reply.code(400);
      return { ok: false, error: `Unknown provider: ${providerId}` };
    }

    const apiKey = requestApiKey || process.env[provider.envVar] || null;
    if (!apiKey) {
      reply.code(400);
      return {
        ok: false,
        error: `No API key provided. Either pass an API key or set ${provider.envVar} environment variable.`,
      };
    }

    try {
      const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const promptText = prompt ?? '';

      const { result, cached } = await withCache(
        'analyze',
        providerId,
        imageData,
        promptText,
        () => provider.analyze(apiKey, imageData, promptText)
      );

      // Always return extractedText and response
      // Only include document if it validates correctly
      const documentResult = DocumentDataSchema.safeParse(result.document);

      const data: VisionResponse = {
        extractedText: result.extractedText,
        response: result.response,
        document: documentResult.success ? documentResult.data : undefined,
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

      const { image, apiKey: requestApiKey, provider: providerId } = parseResult.data;

      const provider = getProviderById(providerId);
      if (!provider) {
        reply.code(400);
        return { ok: false, error: `Unknown provider: ${providerId}` };
      }

      const apiKey = requestApiKey || process.env[provider.envVar] || null;
      if (!apiKey) {
        reply.code(400);
        return {
          ok: false,
          error: `No API key provided. Either pass an API key or set ${provider.envVar} environment variable.`,
        };
      }

      try {
        const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

        const { result, cached } = await withCache(
          'extract_text',
          providerId,
          imageData,
          '', // No prompt for extract_text
          () => provider.extractText(apiKey, imageData)
        );

        return { ok: true, data: { ...result, cached } };
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

    const { text, apiKey: requestApiKey, provider: providerId, prompt } = parseResult.data;

    const provider = getProviderById(providerId);
    if (!provider) {
      reply.code(400);
      return { ok: false, error: `Unknown provider: ${providerId}` };
    }

    const apiKey = requestApiKey || process.env[provider.envVar] || null;
    if (!apiKey) {
      reply.code(400);
      return {
        ok: false,
        error: `No API key provided. Either pass an API key or set ${provider.envVar} environment variable.`,
      };
    }

    try {
      const promptText = prompt ?? '';

      const { result, cached } = await withCache(
        'parse_text',
        providerId,
        text,
        promptText,
        () => provider.parseText(apiKey, text, promptText)
      );

      // Validate document if it exists
      const documentResult = result.document ? DocumentDataSchema.safeParse(result.document) : null;

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
