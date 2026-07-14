import postgres from 'postgres';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const postgresUrl = (process.env.DATABASE_URL || process.env.DIRECT_URL) as string;
const mysqlUrl = process.env.MYSQL_DATABASE_URL as string;

if (!postgresUrl || !mysqlUrl) {
  console.error("❌ ERROR: Database URLs are not defined in the environment variables.");
  console.error("Please ensure DATABASE_URL (or DIRECT_URL) and MYSQL_DATABASE_URL are set in your .env file.");
  process.exit(1);
}

// Ordered tables list for clear migration flow
const TABLES = [
  'Category',
  'User',
  'PaymentConfig',
  'GlobalSessionLockSettings',
  'EmailOtp',
  'VerificationToken',
  'Course',
  'ContactSubmission',
  'DeviceSession',
  'SessionLockSettings',
  'Account',
  'Session',
  'CourseInstructor',
  'Order',
  'LessonProgress',
  'StudentModuleAvailability',
  'Payment',
  'QuizCategory',
  'Quiz',
  'Question',
  'QuizAttempt',
  'AttemptAnswer',
  'QuizQuestionMapping',
  'VideoLibraryNode'
];

function formatVal(val: any): any {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    // Format Date to MySQL compatible datetime string format
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  return val;
}

async function runMigration() {
  console.log("🚀 Starting Database Migration: PostgreSQL -> MariaDB/MySQL...");
  console.log(`Source (Postgres): ${postgresUrl.split('@')[1] || 'Connected'}`);
  console.log(`Target (MySQL): ${mysqlUrl.split('@')[1] || 'Connected'}`);

  // Initialize source connection
  const pgSql = postgres(postgresUrl, { prepare: false });

  // Initialize target connection
  const mysqlConn = await mysql.createConnection({
    uri: mysqlUrl,
    multipleStatements: true,
  });

  try {
    // 1. Disable foreign key checks to avoid constraint violations during migration
    console.log("\n🛑 Disabling foreign key constraints on target database...");
    await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Truncate all target tables first
    console.log("\n🧹 Truncating target tables...");
    for (const table of [...TABLES].reverse()) {
      try {
        console.log(`Truncating ${table}...`);
        await mysqlConn.execute(`DELETE FROM \`${table}\``);
      } catch (err: any) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.error(`\n❌ ERROR: Table "${table}" does not exist in target database.`);
          console.error(`Please run "npx drizzle-kit push" first to initialize the database tables before running this script.`);
          process.exit(1);
        }
        throw err;
      }
    }

    // 3. Migrate tables
    console.log("\n📥 Migrating data table by table...");
    for (const table of TABLES) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Migrating table: ${table}`);

      // Fetch all rows from Postgres
      let rows: any[] = [];
      try {
        rows = await pgSql`SELECT * FROM ${pgSql(table)}`;
      } catch (err: any) {
        console.warn(`⚠️ Warning: Could not read table ${table} from source. Skipping. Detail: ${err.message}`);
        continue;
      }

      if (rows.length === 0) {
        console.log(`⏭️ Table ${table} is empty. Skipping.`);
        continue;
      }

      console.log(`Found ${rows.length} rows to migrate.`);

      // Construct columns list from the first row keys
      const columns = Object.keys(rows[0]);
      const colNamesCsv = columns.map(col => `\`${col}\``).join(', ');

      const batchSize = 100;
      let migratedCount = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuePlaceholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
        const insertSql = `INSERT INTO \`${table}\` (${colNamesCsv}) VALUES ${valuePlaceholders}`;
        const flatValues = batch.flatMap(row => columns.map(col => formatVal(row[col])));

        try {
          await mysqlConn.execute(insertSql, flatValues);
          migratedCount += batch.length;
        } catch (insertErr: any) {
          console.error(`❌ Error inserting batch into ${table}: ${insertErr.message}`);
          console.error(`Attempting single inserts fallback for this batch...`);
          // Fallback to row-by-row inserts for debugging and partial success
          for (const row of batch) {
            const singlePlaceholder = `(${columns.map(() => '?').join(', ')})`;
            const singleInsertSql = `INSERT INTO \`${table}\` (${colNamesCsv}) VALUES ${singlePlaceholder}`;
            const singleValues = columns.map(col => formatVal(row[col]));
            try {
              await mysqlConn.execute(singleInsertSql, singleValues);
              migratedCount++;
            } catch (singleErr: any) {
              console.error(`❌ Failed row ID ${row.id || 'N/A'}: ${singleErr.message}`);
            }
          }
        }
      }

      console.log(`✅ Table ${table} completed: ${migratedCount}/${rows.length} rows migrated.`);
    }

    console.log(`\n--------------------------------------------------`);
    console.log("🔗 Re-enabling foreign key constraints on target database...");
    await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log("🎉 Migration process completed successfully!");

  } catch (error: any) {
    console.error("❌ Migration failed with critical error:", error);
  } finally {
    // Clean up database connections
    console.log("🔌 Closing connection pools...");
    await pgSql.end();
    await mysqlConn.end();
    console.log("👋 Done.");
  }
}

runMigration();
