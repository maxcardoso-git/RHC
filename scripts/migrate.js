#!/usr/bin/env node

/**
 * Database migration script
 * Usage:
 *   node scripts/migrate.js up    - Apply migrations
 *   node scripts/migrate.js down  - Rollback migrations
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:password@localhost:5432/rhc_db');
  process.exit(1);
}

const command = process.argv[2];

if (!command || !['up', 'down'].includes(command)) {
  console.error('❌ ERROR: Invalid command. Use "up" or "down"');
  console.error('Usage:');
  console.error('  node scripts/migrate.js up    - Apply migrations');
  console.error('  node scripts/migrate.js down  - Rollback migrations');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5
  });

  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();

    try {
      // Test connection
      const result = await client.query('SELECT NOW()');
      console.log(`✅ Connected to database at ${result.rows[0].now}`);

      const migrationsPath = join(__dirname, '..', 'migrations');

      if (command === 'up') {
        console.log('\n📦 Applying migrations...');

        // Read and execute the up migration
        const sqlUp = readFileSync(join(migrationsPath, '001_initial_schema.sql'), 'utf-8');

        console.log('🔧 Running 001_initial_schema.sql...');
        await client.query(sqlUp);

        console.log('✅ Migration 001_initial_schema.sql applied successfully');
        console.log('\n✨ All migrations applied successfully!');
      } else if (command === 'down') {
        console.log('\n🔄 Rolling back migrations...');

        // Read and execute the down migration
        const sqlDown = readFileSync(join(migrationsPath, '001_initial_schema_down.sql'), 'utf-8');

        console.log('🔧 Running 001_initial_schema_down.sql...');
        await client.query(sqlDown);

        console.log('✅ Migration 001_initial_schema_down.sql rolled back successfully');
        console.log('\n✨ All migrations rolled back successfully!');
      }

      console.log('\n📊 Current database schema:');
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      if (tables.rows.length === 0) {
        console.log('   (no tables)');
      } else {
        tables.rows.forEach((row) => {
          console.log(`   - ${row.table_name}`);
        });
      }
    } finally {
      client.release();
    }

    console.log('\n✅ Done!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
