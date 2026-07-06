import { Client } from 'pg';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const tables = [
  'User',
  'Course',
  'LessonProgress',
  'StudentModuleAvailability',
  'CourseInstructor',
  'Order',
  'Payment',
  'PaymentConfig',
  'ContactSubmission',
  'DeviceSession',
  'SessionLockSettings',
  'GlobalSessionLockSettings',
  'VideoLibraryNode',
  'Category',
  'EmailOtp',
  'Account',
  'Session',
  'VerificationToken',
];

async function main() {
  console.log("Validating migration: Comparing row counts between Postgres and MySQL...");

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();

  const mySqlConnection = await mysql.createConnection({
    uri: process.env.MYSQL_DATABASE_URL || process.env.MYSQL_DIRECT_URL || ''
  });

  let allMatch = true;

  for (const table of tables) {
    let pgCount = 0;
    let mySqlCount = 0;

    try {
      const pgRes = await pgClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
      pgCount = parseInt(pgRes.rows[0].count, 10);
    } catch (e: any) {
      console.error(`Postgres error for table ${table}:`, e.message);
    }

    try {
      const [rows]: any = await mySqlConnection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      mySqlCount = parseInt(rows[0].count, 10);
    } catch (e: any) {
      console.error(`MySQL error for table ${table}:`, e.message);
    }

    if (pgCount === mySqlCount) {
      console.log(`✅ ${table}: ${pgCount} rows`);
    } else {
      console.error(`❌ ${table} mismatch: Postgres (${pgCount}) vs MySQL (${mySqlCount})`);
      allMatch = false;
    }
  }

  await pgClient.end();
  await mySqlConnection.end();

  if (allMatch) {
    console.log("Validation Successful: All table row counts match!");
  } else {
    console.log("Validation Failed: Some table row counts do not match.");
  }
}

main().catch(console.error);
