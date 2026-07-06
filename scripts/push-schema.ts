import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

async function runMigration() {
  const connectionString = process.env.MYSQL_DIRECT_URL || process.env.MYSQL_DATABASE_URL;

  if (!connectionString) {
    throw new Error('MYSQL_DIRECT_URL or MYSQL_DATABASE_URL environment variable is missing.');
  }

  console.log('Connecting to MySQL database...');
  const pool = mysql.createPool({
    uri: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const db = drizzle(pool);

  console.log('Pushing schema to database using Drizzle Migrator...');
  
  try {
    // This will read the SQL files in the ./drizzle folder and execute them
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Schema pushed successfully! ✅');
  } catch (error) {
    console.error('Error pushing schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
