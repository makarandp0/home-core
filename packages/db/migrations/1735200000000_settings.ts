// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create provider_configs table for storing multiple provider configurations
  pgm.createTable('provider_configs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // User-defined name for this configuration (e.g., "OpenAI_work")
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    // Provider type: 'anthropic', 'openai', 'gemini'
    provider_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    // API key for this provider
    api_key: {
      type: 'text',
      notNull: true,
    },
    // Only one provider can be active at a time
    is_active: {
      type: 'boolean',
      notNull: true,
      default: false,
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

  // Ensure only one provider can be active at a time at the database level
  pgm.createIndex('provider_configs', ['is_active'], {
    unique: true,
    where: 'is_active = true',
    name: 'provider_configs_unique_active',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('provider_configs', ['is_active'], { name: 'provider_configs_unique_active' });
  pgm.dropTable('provider_configs');
}
