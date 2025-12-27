import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add category column for high-level document grouping
  pgm.addColumn('documents', {
    category: {
      type: 'varchar(50)',
      notNull: false,
    },
  });

  // Add issue_date for when document was created/issued
  pgm.addColumn('documents', {
    issue_date: {
      type: 'date',
      notNull: false,
    },
  });

  // Add country column (ISO 3166-1 alpha-2 codes)
  pgm.addColumn('documents', {
    country: {
      type: 'varchar(2)',
      notNull: false,
    },
  });

  // Add amount columns for financial documents
  pgm.addColumn('documents', {
    amount_value: {
      type: 'decimal(15,2)',
      notNull: false,
    },
  });

  pgm.addColumn('documents', {
    amount_currency: {
      type: 'varchar(3)',
      notNull: false,
    },
  });

  // Create indexes for commonly searched fields
  pgm.createIndex('documents', 'category');
  pgm.createIndex('documents', 'country');
  pgm.createIndex('documents', 'issue_date');
  pgm.createIndex('documents', 'document_type');

  // Create GIN index on metadata JSONB for efficient JSON queries
  pgm.createIndex('documents', 'metadata', {
    name: 'documents_metadata_gin',
    method: 'gin',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('documents', 'metadata', { name: 'documents_metadata_gin' });
  pgm.dropIndex('documents', 'document_type');
  pgm.dropIndex('documents', 'issue_date');
  pgm.dropIndex('documents', 'country');
  pgm.dropIndex('documents', 'category');

  pgm.dropColumn('documents', 'amount_currency');
  pgm.dropColumn('documents', 'amount_value');
  pgm.dropColumn('documents', 'country');
  pgm.dropColumn('documents', 'issue_date');
  pgm.dropColumn('documents', 'category');
}
