import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

// Load .env or .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (!process.env.NEON_DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const dbUrl = process.env.NEON_DATABASE_URL;

if (!dbUrl) {
  console.error("Error: NEON_DATABASE_URL is not set.");
  process.exit(1);
}

async function run() {
  console.log("Connecting to Neon Database...");
  const sql = neon(dbUrl);

  console.log("Checking and altering DeviceType enum...");
  try {
    const rows = await sql`
      SELECT e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'DeviceType' AND e.enumlabel = 'tablet'
    `;
    
    if (rows.length === 0) {
      await sql`ALTER TYPE "DeviceType" ADD VALUE 'tablet'`;
      console.log("Successfully added 'tablet' to DeviceType enum.");
    } else {
      console.log("'tablet' already exists in DeviceType enum.");
    }
  } catch (err) {
    console.error("Warning while altering enum (might already exist):", err.message || err);
  }

  console.log("Adding columns to DeviceSession table...");
  try {
    await sql`ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "deviceHash" text`;
    await sql`ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "deviceLabel" text`;
    await sql`ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "osInfo" text`;
    await sql`ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "lockedByDeviceLabel" text`;
    console.log("Columns checked/added successfully.");
  } catch (err) {
    console.error("Error adding columns:", err.message || err);
    process.exit(1);
  }

  console.log("Migration complete!");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
