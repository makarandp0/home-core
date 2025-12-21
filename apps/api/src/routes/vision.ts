import type { FastifyPluginAsync } from 'fastify';
import {
  VisionRequestSchema,
  DocumentDataSchema,
  type VisionResponse,
  type ApiResponse,
  type VisionProvider as VisionProviderType,
} from '@home/types';
import {
  anthropicProvider,
  openaiProvider,
  geminiProvider,
  Anthropic,
  OpenAI,
  type VisionProvider,
} from '../providers/index.js';

// Centralized provider configuration - single source of truth
const PROVIDER_CONFIG: Record<VisionProviderType, { envVar: string; provider: VisionProvider }> = {
  anthropic: { envVar: 'ANTHROPIC_API_KEY', provider: anthropicProvider },
  openai: { envVar: 'OPENAI_API_KEY', provider: openaiProvider },
  gemini: { envVar: 'GEMINI_API_KEY', provider: geminiProvider },
};

const getApiKey = (provider: VisionProviderType, requestApiKey?: string): string | null =>
  requestApiKey || process.env[PROVIDER_CONFIG[provider].envVar] || null;

const getEnvVarName = (provider: VisionProviderType): string => PROVIDER_CONFIG[provider].envVar;

const getProvider = (provider: VisionProviderType): VisionProvider => PROVIDER_CONFIG[provider].provider;

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
      return {
        ok: false,
        error: `No API key provided. Either pass an API key or set ${getEnvVarName(provider)} environment variable.`,
      };
    }

    try {
      const imageData = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

      const visionProvider = getProvider(provider);
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
