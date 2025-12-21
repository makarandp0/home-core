import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisionProvider, VisionResult, DocumentData } from './types.js';
import {
  DOCUMENT_EXTRACTION_PROMPT,
  OCR_SYSTEM_PROMPT,
  PARSING_SYSTEM_PROMPT,
  parseImageData,
  cleanJsonResponse,
  buildFullPrompt,
} from './types.js';

export const geminiProvider: VisionProvider = {
  async analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const { mediaType: mimeType, base64Data } = parseImageData(imageData);

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    // Step 1: OCR - Extract all visible text from the image
    const ocrResult = await model.generateContent([
      { text: OCR_SYSTEM_PROMPT },
      imagePart,
      { text: 'Extract all text visible in this image.' },
    ]);

    const ocrResponse = ocrResult.response;
    const extractedText = ocrResponse.text();

    // Step 2: Parse - Structure the extracted text based on user's prompt
    const fullPrompt = buildFullPrompt(prompt, DOCUMENT_EXTRACTION_PROMPT);

    const parseResult = await model.generateContent([
      { text: PARSING_SYSTEM_PROMPT },
      { text: `Here is text extracted from a document:\n\n---\n${extractedText}\n---\n\n${fullPrompt}` },
    ]);

    const parseResponse = parseResult.response;
    const responseText = parseResponse.text();

    // Try to parse the response as JSON
    let document: DocumentData | undefined;
    try {
      document = JSON.parse(cleanJsonResponse(responseText));
    } catch {
      // If parsing fails, leave document undefined
    }

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
