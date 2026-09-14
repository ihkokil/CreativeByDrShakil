import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const url = new URL(process.env.SUPABASE_DB_URL);
  url.search = '';
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL database.');

  await client.query(`
    ALTER TABLE "GlobalSessionLockSettings" 
    ADD COLUMN IF NOT EXISTS "maxDesktopSessions" integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "maxTabletSessions" integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "maxMobileSessions" integer DEFAULT 1;
  `);
  console.log('Columns added or verified.');

  const res = await client.query('SELECT * FROM "GlobalSessionLockSettings" WHERE id = $1', ['global']);
  console.log('Current global row:', res.rows[0]);

  await client.end();
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
