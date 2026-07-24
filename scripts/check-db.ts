import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No DB URL');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require' });
  const courses = await sql`SELECT id, title, "releaseMode" FROM "Course" LIMIT 10;`;
  console.log(JSON.stringify(courses, null, 2));
  process.exit(0);
}
run();
