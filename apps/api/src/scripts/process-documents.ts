#!/usr/bin/env tsx
/**
 * CLI script to process documents from a directory.
 * Uses the unified /api/documents/upload endpoint for both images and PDFs.
 *
 * IMPORTANT: Requires the API server to be running.
 * NOTE: The --clear-cache option requires direct database access (DATABASE_URL).
 *
 * Usage:
 *   pnpm process-docs <directory> [options]
 *
 * Options:
 *   --provider <name>   Provider to use: gemini, openai, anthropic (default: gemini)
 *   --api-url <url>     API base URL (default: uses HOME_API_PORT env var)
 *   --clear-cache       Clear LLM cache before processing (requires DATABASE_URL)
 *   --dry-run           Show what would be processed without actually processing
 *
 * Examples:
 *   pnpm process-docs ~/Documents/important
 *   pnpm process-docs ./docs --provider openai
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

// Response from unified /api/documents/upload endpoint
interface DocumentUploadResponse {
  documentId: string;
  extractedText: string;
  extractionMethod: 'native' | 'ocr' | 'llm';
  extractionConfidence: number | null;
  document?: {
    document_type: string;
    category?: string;
    name?: string | null;
  };
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached?: boolean;
}

function parseArgs(): { directory: string; options: ProcessOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: process-documents.ts <directory> [options]

IMPORTANT: Requires the API server to be running (pnpm dev:api)
NOTE: The --clear-cache option requires direct database access (DATABASE_URL)

Options:
  --provider <name>   Provider to use: gemini, openai, anthropic (default: gemini)
  --api-url <url>     API base URL (default: uses HOME_API_PORT env var)
  --clear-cache       Clear LLM cache before processing (requires DATABASE_URL)
  --dry-run           Show what would be processed without actually processing
  -h, --help          Show this help message

Examples:
  pnpm process-docs ~/Documents
  pnpm process-docs ./docs --provider openai
`);
    process.exit(0);
  }

  const directory = args[0];
  const apiPort = process.env.HOME_API_PORT ?? '3001';
  const options: ProcessOptions = {
    provider: 'gemini',
    apiUrl: `http://localhost:${apiPort}`,
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

async function checkApiHealth(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Upload and process a document using the unified /api/documents/upload endpoint.
 * Handles both images and PDFs - extracts text and parses to JSON in one call.
 */
async function uploadDocument(
  filePath: string,
  provider: string,
  apiUrl: string
): Promise<{ success: boolean; documentId?: string; data?: DocumentUploadResponse; error?: string }> {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const base64 = await fileToBase64(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  try {
    const response = await fetch(`${apiUrl}/api/documents/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: dataUrl,
        filename: fileName,
        provider,
      }),
    });

    const result: ApiResponse<DocumentUploadResponse> = await response.json();

    if (!result.ok || !result.data) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return {
      success: true,
      documentId: result.data.documentId,
      data: result.data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

async function clearCache(_apiUrl: string): Promise<boolean> {
  // Note: Cache clearing requires direct database access since there's no API endpoint.
  // The _apiUrl parameter is intentionally unused but kept for:
  // 1. Future support of an API-based cache clear endpoint
  // 2. Consistency with other functions that use the apiUrl option
  // This means --clear-cache requires DATABASE_URL to be set in addition to the API server.
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

    const result = await uploadDocument(file, options.provider, options.apiUrl);

    if (result.success && result.data) {
      const { data } = result;
      const cacheStatus = data.cached ? '(cached)' : '(new)';

      // Show extraction info
      const confidence = data.extractionConfidence
        ? ` (${(data.extractionConfidence * 100).toFixed(0)}% confidence)`
        : '';
      console.log(`  ${cacheStatus} Extracted via ${data.extractionMethod}${confidence}`);
      console.log(`  Text length: ${data.extractedText.length} chars`);

      // Show document metadata
      if (data.document) {
        console.log(`  Type: ${data.document.document_type}, Category: ${data.document.category || 'N/A'}`);
        console.log(`  Owner: ${data.document.name || 'N/A'}`);
      } else {
        console.log('  Warning: No document metadata extracted');
      }

      // Show token usage if available
      if (data.usage) {
        console.log(`  Tokens: ${data.usage.totalTokens} (${data.usage.promptTokens} in, ${data.usage.completionTokens} out)`);
      }

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
