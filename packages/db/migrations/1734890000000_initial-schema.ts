import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create documents table
  pgm.createTable('documents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    filename: {
      type: 'varchar(255)',
      notNull: true,
    },
    original_filename: {
      type: 'varchar(255)',
      notNull: true,
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    size_bytes: {
      type: 'bigint',
      notNull: true,
    },
    storage_path: {
      type: 'text',
      notNull: true,
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
    // Document metadata (nullable, can be extracted via AI or set manually)
    expiry_date: {
      type: 'date',
      notNull: false,
    },
    document_type: {
      type: 'varchar(100)',
      notNull: false,
    },
    document_owner: {
      type: 'varchar(255)',
      notNull: false,
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

  // Create index on created_at for sorting
  pgm.createIndex('documents', 'created_at');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('documents');
}
