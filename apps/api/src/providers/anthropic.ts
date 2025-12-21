import Anthropic from '@anthropic-ai/sdk';
import type { VisionProvider, VisionResult, DocumentData } from './types.js';
import {
  DOCUMENT_EXTRACTION_PROMPT,
  OCR_SYSTEM_PROMPT,
  PARSING_SYSTEM_PROMPT,
  parseImageData as parseImageDataBase,
  cleanJsonResponse,
  buildFullPrompt,
} from './types.js';

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

function parseAnthropicImageData(imageData: string): { mediaType: ImageMediaType; base64Data: string } {
  const { mediaType, base64Data } = parseImageDataBase(imageData);

  if (!isValidMediaType(mediaType)) {
    throw new Error(`Unsupported image type: ${mediaType}`);
  }

  return { mediaType, base64Data };
}

export const anthropicProvider: VisionProvider = {
  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const anthropic = new Anthropic({ apiKey });
    const { mediaType, base64Data } = parseAnthropicImageData(imageData);

    // Step 1: OCR - Extract all visible text from the image
    const ocrMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: OCR_SYSTEM_PROMPT,
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
            { type: 'text', text: 'Extract all text visible in this image.' },
          ],
        },
      ],
    });

    const ocrTextBlock = ocrMessage.content.find((block) => block.type === 'text');
    const extractedText = ocrTextBlock?.type === 'text' ? ocrTextBlock.text : '';

    // Step 2: Parse - Structure the extracted text based on user's prompt
    const fullPrompt = buildFullPrompt(prompt, DOCUMENT_EXTRACTION_PROMPT);

    const parseMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PARSING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is text extracted from a document:\n\n---\n${extractedText}\n---\n\n${fullPrompt}`,
        },
      ],
    });

    const parseTextBlock = parseMessage.content.find((block) => block.type === 'text');
    const responseText = parseTextBlock?.type === 'text' ? parseTextBlock.text : '';

    // Try to parse the response as JSON
    let document: DocumentData | undefined;
    try {
      document = JSON.parse(cleanJsonResponse(responseText));
    } catch {
      // If parsing fails, leave document undefined
    }

    return {
      extractedText,
      response: responseText,
      document,
      usage: {
        promptTokens: ocrMessage.usage.input_tokens + parseMessage.usage.input_tokens,
        completionTokens: ocrMessage.usage.output_tokens + parseMessage.usage.output_tokens,
        totalTokens:
          ocrMessage.usage.input_tokens +
          ocrMessage.usage.output_tokens +
          parseMessage.usage.input_tokens +
          parseMessage.usage.output_tokens,
      },
    };
  },
};

export { Anthropic };
