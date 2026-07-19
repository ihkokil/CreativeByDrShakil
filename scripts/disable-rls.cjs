const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const dbUrls = [
  process.env.SUPABASE_DB_URL_1,
  process.env.SUPABASE_DB_URL_2,
  process.env.SUPABASE_DB_URL_3,
  process.env.SUPABASE_DB_URL_4,
  process.env.SUPABASE_DB_URL_5,
  process.env.SUPABASE_DB_URL,
].filter(Boolean);

if (dbUrls.length === 0) {
  console.error("No SUPABASE_DB_URL_N found in .env");
  process.exit(1);
}

const sql = `
DO $$ 
DECLARE 
    r record;
BEGIN 
    -- Drop all policies
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public."' || r.tablename || '";'; 
    END LOOP; 
    
    -- Disable RLS on all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP 
        EXECUTE 'ALTER TABLE public."' || r.tablename || '" DISABLE ROW LEVEL SECURITY;'; 
    END LOOP; 
END $$;
`;

async function disableRls(url, index) {
  // Remove sslmode from query string to allow our ssl config object to take precedence
  const cleanUrl = url.replace('?sslmode=require', '').replace('&sslmode=require', '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`[${index}] Connected to DB`);
    await client.query(sql);
    console.log(`[${index}] Successfully DISABLED RLS policies`);

    // Check if RLS is disabled on all tables
    const result = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'public' 
        AND pg_class.relkind = 'r' 
        AND pg_class.relrowsecurity = true;
    `);

    if (result.rows.length === 0) {
      console.log(`[${index}] Verified: All tables have RLS disabled.`);
    } else {
      result.rows.forEach(row => {
        console.warn(`[${index}] WARNING: Table ${row.relname} still has RLS enabled!`);
      });
    }
  } catch (err) {
    console.error(`[${index}] Error disabling RLS:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`Found ${dbUrls.length} database URLs.`);
  for (let i = 0; i < dbUrls.length; i++) {
    await disableRls(dbUrls[i], i + 1);
  }
}

main();
