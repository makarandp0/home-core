#!/usr/bin/env tsx
/**
 * Reset the database by dropping all tables and recreating the schema.
 * Then runs all migrations to set up a fresh database.
 */

import pg from 'pg';

async function resetDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop and recreate public schema
    console.log('Dropping public schema...');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    console.log('Schema reset complete');

    await client.end();
  } catch (err) {
    console.error('Failed to reset database:', err);
    await client.end();
    process.exit(1);
  }
}

resetDatabase();
