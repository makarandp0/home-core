// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { GoogleGenerativeAI } from '@google/generative-ai';
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
  parseImageData,
  cleanJsonResponse,
  buildFullPrompt,
} from './types.js';

export const geminiProvider: ProviderDefinition = {
  id: 'gemini',
  label: 'Google (Gemini)',
  placeholder: 'AIza...',

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

  async extractText(apiKey: string, imageData: string): Promise<ExtractTextResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const { mediaType: mimeType, base64Data } = parseImageData(imageData);

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    const ocrResult = await model.generateContent([
      { text: OCR_SYSTEM_PROMPT },
      imagePart,
      { text: 'Extract all text visible in this image.' },
    ]);

    const ocrResponse = ocrResult.response;
    const extractedText = ocrResponse.text();
    const usage = ocrResponse.usageMetadata;

    return {
      extractedText,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
    };
  },

  async parseText(apiKey: string, text: string, prompt: string): Promise<ParseTextResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const fullPrompt = buildFullPrompt(prompt, DOCUMENT_EXTRACTION_PROMPT);

    const parseResult = await model.generateContent([
      { text: PARSING_SYSTEM_PROMPT },
      { text: `Here is text extracted from a document:\n\n---\n${text}\n---\n\n${fullPrompt}` },
    ]);

    const parseResponse = parseResult.response;
    const responseText = parseResponse.text();
    const usage = parseResponse.usageMetadata;

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
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
    };
  },
};

export { GoogleGenerativeAI };
