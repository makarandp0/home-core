import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisionProvider, VisionResult, DocumentData } from './types.js';
import { DOCUMENT_EXTRACTION_PROMPT } from './types.js';

export const geminiProvider: VisionProvider = {
  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Parse the base64 image data
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data format');
    }
    const [, mimeType, base64Data] = match;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    // Step 1: OCR - Extract all visible text from the image
    const ocrResult = await model.generateContent([
      {
        text:
          'You are an OCR (Optical Character Recognition) tool. ' +
          'Extract ALL text visible in the image exactly as it appears. ' +
          'Include all words, numbers, dates, and characters. ' +
          'Preserve the layout structure where possible. ' +
          'Do not interpret or summarize - just extract the raw text.',
      },
      imagePart,
      { text: 'Extract all text visible in this image.' },
    ]);

    const ocrResponse = ocrResult.response;
    const extractedText = ocrResponse.text();

    // Step 2: Parse - Structure the extracted text based on user's prompt
    const fullPrompt = prompt
      ? `${prompt}\n\nAdditionally, ${DOCUMENT_EXTRACTION_PROMPT}`
      : DOCUMENT_EXTRACTION_PROMPT;

    const parseResult = await model.generateContent([
      {
        text:
          'You are a text parsing assistant. You will be given raw text extracted from a document. ' +
          'Parse the text and respond with valid JSON only. No markdown, no explanations.',
      },
      { text: `Here is text extracted from a document:\n\n---\n${extractedText}\n---\n\n${fullPrompt}` },
    ]);

    const parseResponse = parseResult.response;
    const responseText = parseResponse.text();

    // Try to parse the response as JSON
    let document: DocumentData | undefined;
    try {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      document = JSON.parse(cleaned);
    } catch {
      // If parsing fails, leave document undefined
    }

    // Gemini doesn't provide token usage in the same way, estimate from text length
    const ocrUsage = ocrResponse.usageMetadata;
    const parseUsage = parseResponse.usageMetadata;

    return {
      extractedText,
      response: responseText,
      document,
      usage: {
        promptTokens: (ocrUsage?.promptTokenCount ?? 0) + (parseUsage?.promptTokenCount ?? 0),
        completionTokens: (ocrUsage?.candidatesTokenCount ?? 0) + (parseUsage?.candidatesTokenCount ?? 0),
        totalTokens: (ocrUsage?.totalTokenCount ?? 0) + (parseUsage?.totalTokenCount ?? 0),
      },
    };
  },
};

export { GoogleGenerativeAI };
