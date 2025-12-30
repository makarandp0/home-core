// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create llm_cache table to store LLM responses
  pgm.createTable('llm_cache', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // SHA-256 hash of (operation_type + provider + input_data + prompt)
    cache_key: {
      type: 'varchar(64)',
      notNull: true,
      unique: true,
    },
    // Type of LLM operation
    operation_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    // Provider used (anthropic, openai, gemini)
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    // Full response data stored as JSON
    response_data: {
      type: 'jsonb',
      notNull: true,
    },
    // Token usage stats
    prompt_tokens: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    completion_tokens: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Index on cache_key for fast lookups
  pgm.createIndex('llm_cache', 'cache_key');

  // Index on created_at for potential cleanup of old entries
  pgm.createIndex('llm_cache', 'created_at');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('llm_cache');
}
