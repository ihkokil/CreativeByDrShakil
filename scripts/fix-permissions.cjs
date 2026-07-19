const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const urls = [
  process.env.SUPABASE_DB_URL,
  process.env.SUPABASE_DB_URL_1,
  process.env.SUPABASE_DB_URL_2,
  process.env.SUPABASE_DB_URL_3,
  process.env.SUPABASE_DB_URL_4,
  process.env.SUPABASE_DB_URL_5,
].filter(Boolean);

async function fixPermissions() {
  console.log(`Found ${urls.length} database URLs.`);
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const cleanUrl = url.replace('?sslmode=require', '').replace('&sslmode=require', '');
    const client = new Client({ 
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client.connect();
      console.log(`[${i + 1}] Connected to DB. Applying grants...`);
      
      await client.query(`
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
      `);
      console.log(`[${i + 1}] Successfully granted privileges to service_role!`);
    } catch (e) {
      console.error(`[${i + 1}] Error:`, e.message);
    } finally {
      await client.end();
    }
  }
}

fixPermissions().catch(console.error);
