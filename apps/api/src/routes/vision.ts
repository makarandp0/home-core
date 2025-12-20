import type { FastifyPluginAsync } from 'fastify';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  VisionRequestSchema,
  VisionResponseSchema,
  type VisionResponse,
  type ApiResponse,
} from '@home/types';

async function callOpenAI(
  apiKey: string,
  imageUrl: string,
  prompt: string
): Promise<VisionResponse> {
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 1024,
  });

  const responseText = completion.choices[0]?.message?.content ?? '';

  return VisionResponseSchema.parse({
    response: responseText,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  });
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SUPPORTED_MEDIA_TYPES: readonly ImageMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

function isValidMediaType(mediaType: string): mediaType is ImageMediaType {
  return SUPPORTED_MEDIA_TYPES.some((type) => type === mediaType);
}

async function callAnthropic(
  apiKey: string,
  imageData: string,
  prompt: string
): Promise<VisionResponse> {
  const anthropic = new Anthropic({ apiKey });

  // Extract base64 data and media type from data URL
  const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data format');
  }
  const [, mediaType, base64Data] = match;

  if (!isValidMediaType(mediaType)) {
    throw new Error(`Unsupported image type: ${mediaType}`);
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  const responseText = textBlock?.type === 'text' ? textBlock.text : '';

  return VisionResponseSchema.parse({
    response: responseText,
    usage: {
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      totalTokens: message.usage.input_tokens + message.usage.output_tokens,
    },
  });
}

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
      const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

      let data: VisionResponse;

      if (provider === 'anthropic') {
        data = await callAnthropic(apiKey, imageUrl, prompt);
      } else {
        data = await callOpenAI(apiKey, imageUrl, prompt);
      }

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
