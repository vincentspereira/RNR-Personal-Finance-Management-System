import { runMigrations } from './migrations';
import { pool } from '../db';

runMigrations()
  .then(async () => {
    console.log('Migration script finished.');
    await pool.end();
  })
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
