const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

async function getColumns() {
  const url = process.env.SUPABASE_DB_URL_1;
  const cleanUrl = url.replace('?sslmode=require', '').replace('&sslmode=require', '');
  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'QuizAttempt';
  `);
  console.log(res.rows);
  await client.end();
}
getColumns();
