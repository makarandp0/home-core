#!/usr/bin/env tsx
// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CLI script to test image resizing functionality.
 * Tests the resizeImageIfNeeded function with various image files.
 *
 * Usage:
 *   pnpm test-resize <image-file> [options]
 *   pnpm test-resize <directory> [options]
 *
 * Options:
 *   --max-size <bytes>  Max size in bytes (default: 3.5MB)
 *   --output <path>     Save resized image to file (only for single file input)
 *   --dry-run           Show what would happen without resizing
 *
 * Examples:
 *   pnpm test-resize ~/large-image.jpg
 *   pnpm test-resize ~/Documents/images
 *   pnpm test-resize ~/photo.png --max-size 2097152  # 2MB limit
 *   pnpm test-resize ~/photo.png --output ~/resized.jpg
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { extname, basename, join } from 'node:path';
import { resizeImageIfNeeded, DEFAULT_SIZE_LIMIT, type ResizeResult } from '../services/image-resize.js';

// Supported image extensions
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']);

// MIME types for extensions
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
};

interface Options {
  maxSize: number;
  output?: string;
  dryRun: boolean;
}

function parseArgs(): { path: string; options: Options } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: test-image-resize.ts <image-file|directory> [options]

Tests the image resizing functionality.

Options:
  --max-size <bytes>  Max size in bytes (default: 3.5MB)
  --output <path>     Save resized image to file (only for single file input)
  --dry-run           Show what would happen without resizing
  -h, --help          Show this help message

Examples:
  pnpm test-resize ~/large-image.jpg
  pnpm test-resize ~/Documents/images
  pnpm test-resize ~/photo.png --max-size 2097152
  pnpm test-resize ~/photo.png --output ~/resized.jpg
`);
    process.exit(0);
  }

  const path = args[0];
  const options: Options = {
    maxSize: DEFAULT_SIZE_LIMIT,
    dryRun: false,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--max-size': {
        const value = args[++i];
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
          console.error(`Invalid value for --max-size: "${value}". Please provide a positive integer number of bytes.`);
          process.exit(1);
        }
        options.maxSize = parsed;
        break;
      }
      case '--output':
        options.output = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }

  return { path, options };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function getImageFiles(inputPath: string): Promise<string[]> {
  const stats = await stat(inputPath);

  if (stats.isFile()) {
    const ext = extname(inputPath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      console.error(`Error: ${inputPath} is not a supported image file`);
      console.error(`Supported extensions: ${Array.from(IMAGE_EXTENSIONS).join(', ')}`);
      process.exit(1);
    }
    return [inputPath];
  }

  if (stats.isDirectory()) {
    const entries = await readdir(inputPath, { withFileTypes: true });
    const imageFiles: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          imageFiles.push(join(inputPath, entry.name));
        }
      }
    }

    return imageFiles.sort();
  }

  console.error(`Error: ${inputPath} is not a file or directory`);
  process.exit(1);
}

async function testResizeImage(
  filePath: string,
  maxSize: number,
  dryRun = false
): Promise<ResizeResult> {
  const buffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'image/jpeg';
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const originalSize = buffer.length;

  console.log(`  Original size: ${formatBytes(originalSize)}`);
  console.log(`  Size limit:    ${formatBytes(maxSize)}`);

  if (dryRun) {
    const needsResize = originalSize > maxSize;
    console.log(`  Would resize:  ${needsResize ? 'Yes' : 'No'}`);
    return {
      imageData: dataUrl,
      resized: needsResize,
      originalSize,
      finalSize: originalSize,
    };
  }

  const result = await resizeImageIfNeeded(dataUrl, maxSize);
  return result;
}

async function saveResizedImage(result: ResizeResult, outputPath: string): Promise<void> {
  // Extract base64 data from data URL
  const match = result.imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }

  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');
  await writeFile(outputPath, buffer);
}

async function main() {
  const { path, options } = parseArgs();

  // Validate path exists
  try {
    await stat(path);
  } catch {
    console.error(`Error: Path not found: ${path}`);
    process.exit(1);
  }

  const files = await getImageFiles(path);

  if (files.length === 0) {
    console.log(`No supported image files found in ${path}`);
    console.log(`Supported extensions: ${Array.from(IMAGE_EXTENSIONS).join(', ')}`);
    process.exit(0);
  }

  // Show output option warning for multiple files
  if (files.length > 1 && options.output) {
    console.log('Warning: --output is only supported for single file input, ignoring\n');
    options.output = undefined;
  }

  console.log(`Testing image resize with ${files.length} file(s)`);
  console.log(`Max size: ${formatBytes(options.maxSize)}`);
  if (options.dryRun) {
    console.log('Mode: Dry run');
  }
  console.log('');

  let resizedCount = 0;
  let skippedCount = 0;
  let totalOriginalBytes = 0;
  let totalFinalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] ${basename(file)}`);

    try {
      const result = await testResizeImage(file, options.maxSize, options.dryRun);

      totalOriginalBytes += result.originalSize;
      totalFinalBytes += result.finalSize;

      if (result.resized) {
        resizedCount++;
        const savings = result.originalSize - result.finalSize;
        const percent = ((savings / result.originalSize) * 100).toFixed(1);
        console.log(`  ✓ Resized:     ${formatBytes(result.originalSize)} → ${formatBytes(result.finalSize)} (-${percent}%)`);

        // Save output if specified
        if (options.output && !options.dryRun) {
          await saveResizedImage(result, options.output);
          console.log(`  ✓ Saved to:    ${options.output}`);
        }
      } else {
        skippedCount++;
        console.log(`  ○ No resize needed (already under limit)`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(`Processed: ${files.length} file(s)`);
  console.log(`  Resized:  ${resizedCount}`);
  console.log(`  Skipped:  ${skippedCount}`);

  if (resizedCount > 0 && !options.dryRun) {
    const totalSavings = totalOriginalBytes - totalFinalBytes;
    const totalPercent = ((totalSavings / totalOriginalBytes) * 100).toFixed(1);
    console.log(`  Savings:  ${formatBytes(totalSavings)} (-${totalPercent}%)`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
