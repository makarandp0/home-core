// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create owner_name_aliases table for mapping variant names to canonical names
  pgm.createTable('owner_name_aliases', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // The alias (variant name to match against)
    alias_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    // The canonical name to replace with
    canonical_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Unique constraint on alias_name (case-insensitive) to prevent duplicate aliases
  pgm.sql(`
    CREATE UNIQUE INDEX owner_name_aliases_alias_lower_unique
    ON owner_name_aliases (LOWER(alias_name));
  `);

  // Index for faster lookups by canonical name
  pgm.createIndex('owner_name_aliases', 'canonical_name');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('owner_name_aliases', 'canonical_name');
  pgm.sql('DROP INDEX owner_name_aliases_alias_lower_unique');
  pgm.dropTable('owner_name_aliases');
}
