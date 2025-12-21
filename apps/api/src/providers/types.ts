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
