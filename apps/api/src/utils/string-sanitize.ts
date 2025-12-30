/**
 * Utility functions for sanitizing string fields.
 */

/**
 * Trim whitespace from a string value.
 * Preserves null/undefined values.
 */
export function trimField(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  return value.trim();
}

/**
 * Convert a string to title case.
 * E.g., "JOHN DOE" -> "John Doe", "john doe" -> "John Doe"
 */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Sanitize a filename for display purposes:
 * 1. Remove file extension
 * 2. Replace underscores and hyphens with spaces
 * 3. Trim whitespace
 * 4. Convert to title case
 *
 * E.g., "my_document.pdf" -> "My Document"
 *       "PASSPORT-SCAN.jpg" -> "Passport Scan"
 */
export function sanitizeFilename(filename: string): string {
  // Remove extension (everything after the last dot, if there's content before it)
  const dotIndex = filename.lastIndexOf('.');
  const nameWithoutExt = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;

  // Replace underscores and hyphens with spaces
  const withSpaces = nameWithoutExt.replace(/[_-]/g, ' ');

  // Trim and convert to title case
  return toTitleCase(withSpaces.trim());
}

/**
 * Trim and convert to title case.
 * Returns null/undefined for null/undefined input.
 */
export function trimAndTitleCase(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  return toTitleCase(value.trim());
}
