export interface DocumentData {
  document_type: string;
  category?: string;
  id?: string;
  reference_numbers?: string[];
  name?: string;
  parties?: string[];
  issue_date?: string;
  expiry_date?: string;
  date_of_birth?: string;
  issuing_authority?: string;
  country?: string;
  state_province?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  amount?: {
    value: number | null;
    currency: string | null;
  } | null;
  language?: string;
  fields: Record<string, unknown>;
  keywords?: string[];
  confidence?: 'high' | 'medium' | 'low';
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

export interface ExtractTextResult {
  extractedText: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ParseTextResult {
  document?: DocumentData;
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface VisionProvider {
  analyze(apiKey: string, imageData: string, prompt: string): Promise<VisionResult>;
  extractText(apiKey: string, imageData: string): Promise<ExtractTextResult>;
  parseText(apiKey: string, text: string, prompt: string): Promise<ParseTextResult>;
}

// Provider definition combines metadata with implementation
export interface ProviderDefinition extends VisionProvider {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
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
  "document_type": "string - must be one of the types listed below, or 'unknown'",
  "category": "string - one of: identity, financial, legal, medical, property, vehicle, education, insurance, correspondence, other",

  "id": "string or null - primary identifier (passport number, invoice number, case number, etc.)",
  "reference_numbers": ["array of any secondary reference numbers, account numbers, or tracking IDs"],

  "name": "string or null - primary person's full name",
  "parties": ["array of all people or organizations mentioned as parties to this document"],

  "issue_date": "string or null - date document was issued/created, YYYY-MM-DD",
  "expiry_date": "string or null - expiration date if present, YYYY-MM-DD",
  "date_of_birth": "string or null - date of birth if present, YYYY-MM-DD",

  "issuing_authority": "string or null - organization that issued the document",
  "country": "string or null - ISO 3166-1 alpha-2 country code (US, GB, CA, etc.)",
  "state_province": "string or null - state or province name",

  "address": {
    "street": "string or null",
    "city": "string or null",
    "state": "string or null",
    "postal_code": "string or null",
    "country": "string or null"
  },

  "amount": {
    "value": "number or null",
    "currency": "string - ISO 4217 code (USD, EUR, etc.)"
  },

  "language": "string - ISO 639-1 language code (en, es, fr, etc.)",

  "fields": {
    "key": "value pairs of important information not captured in the fields above"
  },

  "keywords": ["array of up to 10 searchable terms describing the document"],

  "confidence": "high, medium, or low - your confidence in the extraction accuracy"
}

VALID document_type VALUES (use ONLY these exact values, nothing else):
passport, drivers_license, national_id, visa, birth_certificate, social_security_card, green_card, work_permit,
invoice, receipt, bank_statement, tax_return, w2_form, 1099_form, pay_stub, credit_card_statement, loan_agreement,
contract, lease_agreement, power_of_attorney, will, court_order, affidavit, notarized_document,
medical_record, prescription, vaccination_record, insurance_card, lab_results, discharge_summary,
deed, title, mortgage, property_tax_bill, home_insurance_policy,
vehicle_registration, vehicle_title, auto_insurance_card, smog_certificate,
diploma, transcript, degree_certificate, professional_license,
insurance_policy, insurance_claim, coverage_summary,
letter, notice, bill, statement,
photo, certificate, membership_card, unknown

CATEGORY MAPPING (set category based on document_type):
- identity: passport, drivers_license, national_id, visa, birth_certificate, social_security_card, green_card, work_permit
- financial: invoice, receipt, bank_statement, tax_return, w2_form, 1099_form, pay_stub, credit_card_statement, loan_agreement
- legal: contract, lease_agreement, power_of_attorney, will, court_order, affidavit, notarized_document
- medical: medical_record, prescription, vaccination_record, insurance_card, lab_results, discharge_summary
- property: deed, title, mortgage, property_tax_bill, home_insurance_policy
- vehicle: vehicle_registration, vehicle_title, auto_insurance_card, smog_certificate
- education: diploma, transcript, degree_certificate, professional_license
- insurance: insurance_policy, insurance_claim, coverage_summary
- correspondence: letter, notice, bill, statement
- other: photo, certificate, membership_card, unknown

CRITICAL RULES:
- document_type must be EXACTLY one of the values listed above. Use "passport", not "Identity: passport" or any other format
- category must be one of: identity, financial, legal, medical, property, vehicle, education, insurance, correspondence, other
- All dates MUST be in YYYY-MM-DD format (e.g., 2025-12-31)
- Use null for fields not found in the document
- For address, include only if a complete or partial address is found, otherwise null
- For amount, include only for documents with monetary values, otherwise null
- Return ONLY valid JSON, no markdown or explanations`;
