import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const dbUrls = [
  process.env.SUPABASE_DB_URL,
  process.env.SUPABASE_DB_URL_1,
  process.env.SUPABASE_DB_URL_2,
  process.env.SUPABASE_DB_URL_3,
  process.env.SUPABASE_DB_URL_4,
  process.env.SUPABASE_DB_URL_5,
].filter(Boolean) as string[];

async function run() {
  for (let i = 0; i < dbUrls.length; i++) {
    const url = dbUrls[i];
    console.log(`Connecting to DB instance ${i}...`);
    const sql = postgres(url, { max: 1 });
    try {
      await sql`ALTER TABLE "Batch" ALTER COLUMN "startDate" DROP NOT NULL;`;
      console.log(`[DB ${i}] "startDate" column set to DROP NOT NULL successfully.`);
    } catch (err: any) {
      console.log(`[DB ${i}] "startDate" ALTER info:`, err.message);
    }

    try {
      await sql`ALTER TABLE "Batch" ALTER COLUMN "endDate" DROP NOT NULL;`;
      console.log(`[DB ${i}] "endDate" column set to DROP NOT NULL successfully.`);
    } catch (err: any) {
      console.log(`[DB ${i}] "endDate" ALTER info:`, err.message);
    }

    try {
      await sql`NOTIFY pgrst, 'reload schema';`;
      console.log(`[DB ${i}] Reloaded PostgREST schema cache.`);
    } catch (err: any) {
      console.error(`[DB ${i}] Failed to reload schema:`, err.message);
    }
    await sql.end();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
