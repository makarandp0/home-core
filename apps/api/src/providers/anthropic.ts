import Anthropic from '@anthropic-ai/sdk';
import type { VisionProvider, VisionResult, DocumentData } from './types.js';
import { DOCUMENT_EXTRACTION_PROMPT } from './types.js';

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

function parseImageData(imageData: string): { mediaType: ImageMediaType; base64Data: string } {
  const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data format');
  }
  const [, mediaType, base64Data] = match;

  if (!isValidMediaType(mediaType)) {
    throw new Error(`Unsupported image type: ${mediaType}`);
  }

  return { mediaType, base64Data };
}

export const anthropicProvider: VisionProvider = {
  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const anthropic = new Anthropic({ apiKey });
    const { mediaType, base64Data } = parseImageData(imageData);

    // Step 1: OCR - Extract all visible text from the image
    const ocrMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:
        'You are an OCR (Optical Character Recognition) tool. ' +
        'Extract ALL text visible in the image exactly as it appears. ' +
        'Include all words, numbers, dates, and characters. ' +
        'Preserve the layout structure where possible. ' +
        'Do not interpret or summarize - just extract the raw text.',
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
    const fullPrompt = prompt
      ? `${prompt}\n\nAdditionally, ${DOCUMENT_EXTRACTION_PROMPT}`
      : DOCUMENT_EXTRACTION_PROMPT;

    const parseMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:
        'You are a text parsing assistant. You will be given raw text extracted from a document. ' +
        'Parse the text and respond with valid JSON only. No markdown, no explanations.',
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
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      document = JSON.parse(cleaned);
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
