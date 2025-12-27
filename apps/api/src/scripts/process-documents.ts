#!/usr/bin/env tsx
/**
 * CLI script to process documents from a directory.
 * Uses the same HTTP API endpoints as the frontend for consistency.
 *
 * IMPORTANT: Requires the API server to be running.
 *
 * Usage:
 *   pnpm process-docs <directory> [options]
 *
 * Options:
 *   --provider <name>   Provider to use: gemini, openai, anthropic (default: gemini)
 *   --api-url <url>     API base URL (default: http://localhost:3000)
 *   --clear-cache       Clear LLM cache before processing
 *   --dry-run           Show what would be processed without actually processing
 *
 * Examples:
 *   pnpm process-docs ~/Documents/important
 *   pnpm process-docs ./docs --provider openai
 *   pnpm process-docs ./docs --api-url http://localhost:3001
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

// Supported file extensions
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
const PDF_EXTENSIONS = new Set(['.pdf']);

// MIME types for extensions
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

interface ProcessOptions {
  provider: string;
  apiUrl: string;
  clearCache: boolean;
  dryRun: boolean;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface VisionResponse {
  extractedText: string;
  response: string;
  document?: {
    document_type: string;
    category?: string;
    name?: string | null;
  };
  documentId: string;
  cached?: boolean;
}

interface DocumentProcessResponse {
  text: string;
  pageCount: number;
  method: string;
  confidence?: number;
  documentId: string;
}

interface ParseResponse {
  document?: {
    document_type: string;
    category?: string;
    name?: string | null;
  };
  response: string;
  cached?: boolean;
}

function parseArgs(): { directory: string; options: ProcessOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: process-documents.ts <directory> [options]

IMPORTANT: Requires the API server to be running (pnpm dev:api)

Options:
  --provider <name>   Provider to use: gemini, openai, anthropic (default: gemini)
  --api-url <url>     API base URL (default: http://localhost:3000)
  --clear-cache       Clear LLM cache before processing
  --dry-run           Show what would be processed without actually processing
  -h, --help          Show this help message

Examples:
  pnpm process-docs ~/Documents
  pnpm process-docs ./docs --provider openai
  pnpm process-docs ./docs --api-url http://localhost:3001
`);
    process.exit(0);
  }

  const directory = args[0];
  const options: ProcessOptions = {
    provider: 'gemini',
    apiUrl: 'http://localhost:3000',
    clearCache: false,
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--provider':
        options.provider = args[++i];
        break;
      case '--api-url':
        options.apiUrl = args[++i];
        break;
      case '--clear-cache':
        options.clearCache = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }

  return { directory, options };
}

async function getFilesToProcess(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(join(directory, entry.name));
      }
    }
  }

  return files.sort();
}

async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString('base64');
}

function fileToDataUrl(base64: string, ext: string): string {
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  return `data:${mimeType};base64,${base64}`;
}

async function checkApiHealth(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function processImage(
  filePath: string,
  base64: string,
  ext: string,
  provider: string,
  apiUrl: string
): Promise<{ success: boolean; documentId?: string; document?: VisionResponse['document']; cached?: boolean; error?: string }> {
  const fileName = basename(filePath);
  const dataUrl = fileToDataUrl(base64, ext);

  const response = await fetch(`${apiUrl}/api/vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: dataUrl,
      fileName,
      provider,
    }),
  });

  const result: ApiResponse<VisionResponse> = await response.json();

  if (!result.ok || !result.data) {
    return { success: false, error: result.error || 'Vision API failed' };
  }

  return {
    success: true,
    documentId: result.data.documentId,
    document: result.data.document,
    cached: result.data.cached,
  };
}

async function processPdf(
  filePath: string,
  base64: string,
  provider: string,
  apiUrl: string
): Promise<{ success: boolean; documentId?: string; document?: ParseResponse['document']; cached?: boolean; error?: string }> {
  const fileName = basename(filePath);

  // Step 1: Extract text using doc-processor
  const processResponse = await fetch(`${apiUrl}/api/documents/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: base64,
      filename: fileName,
    }),
  });

  const processResult: ApiResponse<DocumentProcessResponse> = await processResponse.json();

  if (!processResult.ok || !processResult.data) {
    return { success: false, error: processResult.error || 'Doc processor failed' };
  }

  const { text, documentId, method, confidence } = processResult.data;
  console.log(`  Extracted ${text.length} chars via ${method}${confidence ? ` (${(confidence * 100).toFixed(0)}% confidence)` : ''}`);

  // Step 2: Parse extracted text with LLM
  const parseResponse = await fetch(`${apiUrl}/api/vision/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      provider,
      documentId,
    }),
  });

  const parseResult: ApiResponse<ParseResponse> = await parseResponse.json();

  if (!parseResult.ok) {
    return { success: false, error: parseResult.error || 'Parse API failed' };
  }

  return {
    success: true,
    documentId,
    document: parseResult.data?.document,
    cached: parseResult.data?.cached,
  };
}

async function processFile(
  filePath: string,
  provider: string,
  apiUrl: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const ext = extname(filePath).toLowerCase();
  const base64 = await fileToBase64(filePath);
  const isPdf = PDF_EXTENSIONS.has(ext);

  try {
    const result = isPdf
      ? await processPdf(filePath, base64, provider, apiUrl)
      : await processImage(filePath, base64, ext, provider, apiUrl);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const cacheStatus = result.cached ? '(cached)' : '(new)';
    if (!isPdf) {
      console.log(`  ${cacheStatus} Processed`);
    }

    if (result.document) {
      console.log(`  Type: ${result.document.document_type}, Category: ${result.document.category || 'N/A'}`);
      console.log(`  Owner: ${result.document.name || 'N/A'}`);
    } else {
      console.log('  Warning: No document metadata extracted');
    }

    return { success: true, documentId: result.documentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

async function clearCache(_apiUrl: string): Promise<boolean> {
  // Note: This requires a cache clear endpoint or direct DB access
  // For now, we'll use direct DB access since there's no API endpoint
  const { getDb, llmCache } = await import('@home/db');
  const db = getDb();
  await db.delete(llmCache);
  return true;
}

async function main() {
  const { directory, options } = parseArgs();

  // Validate directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      console.error(`Error: ${directory} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Directory not found: ${directory}`);
    process.exit(1);
  }

  // Get files to process
  const files = await getFilesToProcess(directory);
  if (files.length === 0) {
    console.log(`No supported files found in ${directory}`);
    console.log(`Supported extensions: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
    process.exit(0);
  }

  console.log(`Found ${files.length} file(s) to process in ${directory}`);
  console.log(`Provider: ${options.provider}`);
  console.log(`API URL: ${options.apiUrl}`);
  console.log('');

  if (options.dryRun) {
    console.log('Dry run - files that would be processed:');
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const type = PDF_EXTENSIONS.has(ext) ? 'PDF' : 'Image';
      console.log(`  - ${basename(file)} (${type})`);
    }
    process.exit(0);
  }

  // Check API is running
  const apiHealthy = await checkApiHealth(options.apiUrl);
  if (!apiHealthy) {
    console.error(`Error: Cannot connect to API at ${options.apiUrl}`);
    console.error('Make sure the API server is running: pnpm dev:api');
    process.exit(1);
  }

  // Clear cache if requested
  if (options.clearCache) {
    console.log('Clearing LLM cache...');
    await clearCache(options.apiUrl);
    console.log('Cache cleared.\n');
  }

  // Process files
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = extname(file).toLowerCase();
    const type = PDF_EXTENSIONS.has(ext) ? 'PDF' : 'Image';
    console.log(`[${i + 1}/${files.length}] Processing ${type}: ${basename(file)}`);

    const result = await processFile(file, options.provider, options.apiUrl);

    if (result.success) {
      console.log(`  ✓ Stored as: ${result.documentId}`);
      successCount++;
    } else {
      console.log(`  ✗ Error: ${result.error}`);
      failCount++;
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(`Completed: ${successCount} success, ${failCount} failed`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
