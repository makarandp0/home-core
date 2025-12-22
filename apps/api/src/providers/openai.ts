import OpenAI from 'openai';
import type {
  ProviderDefinition,
  VisionResult,
  DocumentData,
  ExtractTextResult,
  ParseTextResult,
} from './types.js';
import {
  DOCUMENT_EXTRACTION_PROMPT,
  OCR_SYSTEM_PROMPT,
  PARSING_SYSTEM_PROMPT,
  cleanJsonResponse,
  buildFullPrompt,
} from './types.js';

export const openaiProvider: ProviderDefinition = {
  id: 'openai',
  label: 'OpenAI (GPT-4o)',
  placeholder: 'sk-...',
  envVar: 'OPENAI_API_KEY',

  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const openai = new OpenAI({ apiKey });

    // Ensure image data is in data URL format
    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;

    // Step 1: OCR - Extract all visible text from the image
    const ocrCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text visible in this image.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const extractedText = ocrCompletion.choices[0]?.message?.content ?? '';

    // Step 2: Parse - Structure the extracted text based on user's prompt
    const fullPrompt = buildFullPrompt(prompt, DOCUMENT_EXTRACTION_PROMPT);

    const parseCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: PARSING_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is text extracted from a document:\n\n---\n${extractedText}\n---\n\n${fullPrompt}`,
        },
      ],
    });

    const responseText = parseCompletion.choices[0]?.message?.content ?? '';

    // Try to parse the response as JSON
    let document: DocumentData | undefined;
    try {
      document = JSON.parse(cleanJsonResponse(responseText));
    } catch {
      // If parsing fails, leave document undefined
    }

    const ocrUsage = ocrCompletion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const parseUsage = parseCompletion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      extractedText,
      response: responseText,
      document,
      usage: {
        promptTokens: ocrUsage.prompt_tokens + parseUsage.prompt_tokens,
        completionTokens: ocrUsage.completion_tokens + parseUsage.completion_tokens,
        totalTokens: ocrUsage.total_tokens + parseUsage.total_tokens,
      },
    };
  },

  async extractText(apiKey: string, imageData: string): Promise<ExtractTextResult> {
    const openai = new OpenAI({ apiKey });

    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;

    const ocrCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text visible in this image.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const extractedText = ocrCompletion.choices[0]?.message?.content ?? '';
    const usage = ocrCompletion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      extractedText,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    };
  },

  async parseText(apiKey: string, text: string, prompt: string): Promise<ParseTextResult> {
    const openai = new OpenAI({ apiKey });
    const fullPrompt = buildFullPrompt(prompt, DOCUMENT_EXTRACTION_PROMPT);

    const parseCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: PARSING_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is text extracted from a document:\n\n---\n${text}\n---\n\n${fullPrompt}`,
        },
      ],
    });

    const responseText = parseCompletion.choices[0]?.message?.content ?? '';
    const usage = parseCompletion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    let document: DocumentData | undefined;
    try {
      document = JSON.parse(cleanJsonResponse(responseText));
    } catch {
      // If parsing fails, leave document undefined
    }

    return {
      document,
      response: responseText,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    };
  },
};

export { OpenAI };
