// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration to sanitize existing document metadata:
 * - original_filename: trim, remove extension, replace underscores/hyphens with spaces, title case
 * - document_owner: trim and title case
 * - document_type: trim
 * - category: trim
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Trim and title case original_filename (remove extension, replace underscores/hyphens)
  pgm.sql(`
    UPDATE documents
    SET original_filename = INITCAP(
      TRIM(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(original_filename, '\\.[^.]+$', ''),
            '_', ' ', 'g'
          ),
          '-', ' ', 'g'
        )
      )
    )
    WHERE original_filename IS NOT NULL
  `);

  // Trim and title case document_owner
  pgm.sql(`
    UPDATE documents
    SET document_owner = INITCAP(TRIM(document_owner))
    WHERE document_owner IS NOT NULL
  `);

  // Trim document_type
  pgm.sql(`
    UPDATE documents
    SET document_type = TRIM(document_type)
    WHERE document_type IS NOT NULL
  `);

  // Trim category
  pgm.sql(`
    UPDATE documents
    SET category = TRIM(category)
    WHERE category IS NOT NULL
  `);
}

export async function down(_pgm: MigrationBuilder): Promise<void> {
  // Data transformation is lossy - cannot revert trim/title case changes
  // Original values are not preserved
}
