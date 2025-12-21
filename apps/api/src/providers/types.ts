export interface DocumentData {
  document_type: string;
  id?: string;
  expiry_date?: string;
  name?: string;
  fields: Record<string, string>;
}

export interface VisionResult {
  extractedText: string;
  response: string;
  document?: DocumentData;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface VisionProvider {
  analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult>;
}

// Provider definition combines metadata with implementation
export interface ProviderDefinition extends VisionProvider {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly envVar: string;
}

// Shared system prompts - used by all providers
export const OCR_SYSTEM_PROMPT =
  'You are an OCR (Optical Character Recognition) tool. ' +
  'Extract ALL text visible in the image exactly as it appears. ' +
  'Include all words, numbers, dates, and characters. ' +
  'Preserve the layout structure where possible. ' +
  'Do not interpret or summarize - just extract the raw text.';

export const PARSING_SYSTEM_PROMPT =
  'You are a text parsing assistant. You will be given raw text extracted from a document. ' +
  'Parse the text and respond with valid JSON only. No markdown, no explanations.';

// Shared utilities
export function parseImageData(imageData: string): { mediaType: string; base64Data: string } {
  const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data format');
  }
  const [, mediaType, base64Data] = match;
  return { mediaType, base64Data };
}

export function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

export function buildFullPrompt(prompt: string, extractionPrompt: string): string {
  return prompt ? `${prompt}\n\nAdditionally, ${extractionPrompt}` : extractionPrompt;
}

export const DOCUMENT_EXTRACTION_PROMPT = `Analyze the extracted text and return a JSON object with the following structure:
{
  "document_type": "string - type of document (e.g., driver_license, passport, id_card, invoice, receipt, etc.)",
  "id": "string or null - the primary identifier of the document (e.g., passport number, driver's license number, invoice number, etc.)",
  "expiry_date": "string or null - expiration date if present, formatted as YYYY-MM-DD",
  "name": "string or null - person's name if present",
  "fields": {
    "key": "value pairs of all other important information found in the document"
  }
}

Important: All dates must be formatted as YYYY-MM-DD (e.g., 2025-12-31).
Return ONLY the JSON object, no additional text or markdown.`;
