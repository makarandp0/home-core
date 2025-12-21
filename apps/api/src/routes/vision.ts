import type { FastifyPluginAsync } from 'fastify';
import {
  VisionRequestSchema,
  DocumentDataSchema,
  type VisionResponse,
  type ApiResponse,
} from '@home/types';
import { anthropicProvider, openaiProvider, Anthropic, OpenAI } from '../providers/index.js';

function getApiKey(provider: 'openai' | 'anthropic', requestApiKey?: string): string | null {
  if (requestApiKey) {
    return requestApiKey;
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY ?? null;
  }
  return process.env.OPENAI_API_KEY ?? null;
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

    const { image, prompt, apiKey: requestApiKey, provider } = parseResult.data;

    const apiKey = getApiKey(provider, requestApiKey);
    if (!apiKey) {
      reply.code(400);
      const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      return {
        ok: false,
        error: `No API key provided. Either pass an API key or set ${envVar} environment variable.`,
      };
    }

    try {
      const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

      const visionProvider = provider === 'anthropic' ? anthropicProvider : openaiProvider;
      const result = await visionProvider.analyze(apiKey, imageData, prompt ?? '');

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
