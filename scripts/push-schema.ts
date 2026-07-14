import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

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
  'VideoLibraryNode',
  '__drizzle_migrations',
  '_prisma_migrations'
];

async function main() {
  const { db } = await import('../src/lib/db');
  const { migrate } = await import('drizzle-orm/mysql2/migrator');
  const path = await import('path');
  const mysql = await import('mysql2/promise');

  console.log("🧹 Dropping any existing tables in target MySQL database...");
  const mysqlConn = await mysql.createConnection({
    uri: process.env.MYSQL_DATABASE_URL!,
    multipleStatements: true,
  });

  await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    try {
      await mysqlConn.execute(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`Dropped table ${table} if existed.`);
    } catch (err: any) {
      console.warn(`Could not drop table ${table}: ${err.message}`);
    }
  }
  await mysqlConn.execute('SET FOREIGN_KEY_CHECKS = 1');
  await mysqlConn.end();

  console.log("⏳ Running schema migrations on MySQL database...");
  const migrationsFolder = path.resolve(process.cwd(), './drizzle');
  
  await migrate(db, { migrationsFolder });
  
  console.log("✅ Schema migrations successfully completed!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
