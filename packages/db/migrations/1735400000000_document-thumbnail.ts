import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add thumbnail column for storing base64 document preview image
  // Stored as TEXT since base64 thumbnails are ~10-15KB
  pgm.addColumn('documents', {
    thumbnail: {
      type: 'text',
      notNull: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('documents', 'thumbnail');
}
