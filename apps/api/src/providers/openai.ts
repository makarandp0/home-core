import OpenAI from 'openai';
import type { VisionProvider, VisionResult, DocumentData } from './types.js';
import { DOCUMENT_EXTRACTION_PROMPT } from './types.js';

export const openaiProvider: VisionProvider = {
  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const openai = new OpenAI({ apiKey });

    // Ensure image data is in data URL format
    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;

    // Step 1: OCR - Extract all visible text from the image
    const ocrCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content:
            'You are an OCR (Optical Character Recognition) tool. ' +
            'Extract ALL text visible in the image exactly as it appears. ' +
            'Include all words, numbers, dates, and characters. ' +
            'Preserve the layout structure where possible. ' +
            'Do not interpret or summarize - just extract the raw text.',
        },
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
    const fullPrompt = prompt
      ? `${prompt}\n\nAdditionally, ${DOCUMENT_EXTRACTION_PROMPT}`
      : DOCUMENT_EXTRACTION_PROMPT;

    const parseCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content:
            'You are a text parsing assistant. You will be given raw text extracted from a document. ' +
            'Parse the text and respond with valid JSON only. No markdown, no explanations.',
        },
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
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      document = JSON.parse(cleaned);
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
};

export { OpenAI };
