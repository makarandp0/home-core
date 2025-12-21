import type { FastifyPluginAsync } from 'fastify';
import {
  VisionRequestSchema,
  DocumentDataSchema,
  type VisionResponse,
  type ApiResponse,
} from '@home/types';
import { getProviderById, Anthropic, OpenAI } from '../providers/index.js';

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

      const result = await provider.analyze(apiKey, imageData, prompt ?? '');

      // Always return extractedText and response
      // Only include document if it validates correctly
      const documentResult = DocumentDataSchema.safeParse(result.document);

      const data: VisionResponse = {
        extractedText: result.extractedText,
        response: result.response,
        document: documentResult.success ? documentResult.data : undefined,
        usage: result.usage,
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
