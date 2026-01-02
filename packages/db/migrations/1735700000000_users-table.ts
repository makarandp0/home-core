// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create users table for storing Firebase user information locally
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // Firebase UID - unique identifier from Firebase Auth
    firebase_uid: {
      type: 'varchar(128)',
      notNull: true,
      unique: true,
    },
    // User's email address
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    // Display name (from Firebase or user-set)
    display_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    // Profile photo URL
    photo_url: {
      type: 'text',
      notNull: false,
    },
    // Auth provider: 'password', 'google.com', or 'anonymous' for default user
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    last_login_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Index for fast lookups by Firebase UID
  pgm.createIndex('users', 'firebase_uid');

  // Index for email lookups
  pgm.createIndex('users', 'email');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('users', 'email');
  pgm.dropIndex('users', 'firebase_uid');
  pgm.dropTable('users');
}
