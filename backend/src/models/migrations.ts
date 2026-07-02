import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db';

/**
 * Numbered, idempotent SQL migrations driven by a schema_migrations table.
 *
 * Layout:
 *   backend/migrations/NNN_name.sql
 *
 * Behaviour:
 *   - Creates schema_migrations(version, applied_at) on first run.
 *   - Reads every *.sql file in the migrations folder, sorts by filename.
 *   - For each version not yet applied, runs the SQL in a transaction +
 *     records its version. Concurrent runners are guarded by a pg advisory lock.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const ADVISORY_LOCK_KEY = 7349123749000;

async function ensureMigrationsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function listAppliedVersions(client: any): Promise<Set<string>> {
  const r = await client.query('SELECT version FROM schema_migrations');
  return new Set<string>(r.rows.map((row: any) => row.version));
}

async function listMigrationFiles(): Promise<{ version: string; file: string }[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(MIGRATIONS_DIR);
  } catch {
    return [];
  }
  const files = entries.filter(f => f.endsWith('.sql')).sort();
  return files.map(f => ({ version: f.replace(/\.sql$/, ''), file: path.join(MIGRATIONS_DIR, f) }));
}

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    // Advisory lock so concurrent boots don't race on ALTER TABLE.
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    await ensureMigrationsTable(client);
    const applied = await listAppliedVersions(client);
    const files = await listMigrationFiles();

    let appliedCount = 0;
    for (const { version, file } of files) {
      if (applied.has(version)) continue;
      const sql = await fs.readFile(file, 'utf8');
      console.log(`  Applying ${version}…`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING',
          [version]
        );
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration ${version} failed:`, err);
        throw err;
      }
    }

    console.log(`Migrations completed (${appliedCount} new, ${files.length - appliedCount} already applied).`);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]); } catch { /* ignore */ }
    client.release();
  }
}
