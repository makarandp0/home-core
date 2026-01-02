// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

// Fixed UUID for the default anonymous user (used when AUTH_ENABLED=false)
// This must match the UUID used in the application code
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // First, create the default anonymous user
  // This user is used when authentication is disabled (local dev, self-hosted single-user)
  pgm.sql(`
    INSERT INTO users (id, firebase_uid, email, display_name, provider, created_at, last_login_at)
    VALUES (
      '${DEFAULT_USER_ID}',
      'anonymous',
      'anonymous@local',
      'Local User',
      'anonymous',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  // Add user_id to documents table
  pgm.addColumn('documents', {
    user_id: {
      type: 'uuid',
      notNull: false, // Allow null initially for migration
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('documents', 'user_id');

  // Assign existing documents to the default user
  pgm.sql(`UPDATE documents SET user_id = '${DEFAULT_USER_ID}' WHERE user_id IS NULL;`);

  // Now make user_id NOT NULL after backfilling
  pgm.alterColumn('documents', 'user_id', { notNull: true });

  // Add user_id to provider_configs table
  pgm.addColumn('provider_configs', {
    user_id: {
      type: 'uuid',
      notNull: false, // Allow null initially for migration
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('provider_configs', 'user_id');

  // Assign existing provider configs to the default user
  pgm.sql(`UPDATE provider_configs SET user_id = '${DEFAULT_USER_ID}' WHERE user_id IS NULL;`);

  // Now make user_id NOT NULL after backfilling
  pgm.alterColumn('provider_configs', 'user_id', { notNull: true });

  // Drop the old unique active constraint and create a per-user one
  pgm.sql('DROP INDEX IF EXISTS provider_configs_unique_active;');
  pgm.sql(`
    CREATE UNIQUE INDEX provider_configs_unique_active_per_user
    ON provider_configs (user_id)
    WHERE is_active = true;
  `);

  // Add user_id to owner_name_aliases table
  pgm.addColumn('owner_name_aliases', {
    user_id: {
      type: 'uuid',
      notNull: false, // Allow null initially for migration
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.createIndex('owner_name_aliases', 'user_id');

  // Assign existing aliases to the default user
  pgm.sql(`UPDATE owner_name_aliases SET user_id = '${DEFAULT_USER_ID}' WHERE user_id IS NULL;`);

  // Now make user_id NOT NULL after backfilling
  pgm.alterColumn('owner_name_aliases', 'user_id', { notNull: true });

  // Update unique constraint on alias to be per-user (case-insensitive)
  pgm.sql('DROP INDEX IF EXISTS owner_name_aliases_alias_lower_unique;');
  pgm.sql(`
    CREATE UNIQUE INDEX owner_name_aliases_alias_lower_per_user_unique
    ON owner_name_aliases (user_id, LOWER(alias_name));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Restore original unique constraint on owner_name_aliases
  pgm.sql('DROP INDEX IF EXISTS owner_name_aliases_alias_lower_per_user_unique;');
  pgm.sql(`
    CREATE UNIQUE INDEX owner_name_aliases_alias_lower_unique
    ON owner_name_aliases (LOWER(alias_name));
  `);

  // Remove user_id from owner_name_aliases
  pgm.dropIndex('owner_name_aliases', 'user_id');
  pgm.dropColumn('owner_name_aliases', 'user_id');

  // Restore original unique active constraint on provider_configs
  pgm.sql('DROP INDEX IF EXISTS provider_configs_unique_active_per_user;');
  pgm.sql(`
    CREATE UNIQUE INDEX provider_configs_unique_active
    ON provider_configs (is_active)
    WHERE is_active = true;
  `);

  // Remove user_id from provider_configs
  pgm.dropIndex('provider_configs', 'user_id');
  pgm.dropColumn('provider_configs', 'user_id');

  // Remove user_id from documents
  pgm.dropIndex('documents', 'user_id');
  pgm.dropColumn('documents', 'user_id');

  // Remove the default anonymous user
  pgm.sql(`DELETE FROM users WHERE id = '${DEFAULT_USER_ID}';`);
}
