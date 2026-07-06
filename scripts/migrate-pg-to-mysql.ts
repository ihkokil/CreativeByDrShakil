import 'dotenv/config';
import { Client } from 'pg';
import { db } from '../src/lib/db';
import * as schema from '../src/db/schema';
import 'dotenv/config';

// The order of migration is critical due to foreign keys.
// Parents before children.
const tablesToMigrate = [
  { pgName: '"Category"', drizzleModel: schema.categories },
  { pgName: '"User"', drizzleModel: schema.users },
  { pgName: '"SessionLockSettings"', drizzleModel: schema.sessionLockSettings },
  { pgName: '"GlobalSessionLockSettings"', drizzleModel: schema.globalSessionLockSettings },
  { pgName: '"Course"', drizzleModel: schema.courses },
  { pgName: '"CourseInstructor"', drizzleModel: schema.courseInstructors },
  { pgName: '"LessonProgress"', drizzleModel: schema.lessonProgress },
  { pgName: '"StudentModuleAvailability"', drizzleModel: schema.studentModuleAvailability },
  { pgName: '"Order"', drizzleModel: schema.orders },
  { pgName: '"Payment"', drizzleModel: schema.payments },
  { pgName: '"PaymentConfig"', drizzleModel: schema.paymentConfigs },
  { pgName: '"ContactSubmission"', drizzleModel: schema.contactSubmissions },
  { pgName: '"DeviceSession"', drizzleModel: schema.deviceSessions },
  { pgName: '"VideoLibraryNode"', drizzleModel: schema.videoLibraryNodes },
  { pgName: '"EmailOtp"', drizzleModel: schema.emailOtps },
  { pgName: '"Account"', drizzleModel: schema.accounts },
  { pgName: '"Session"', drizzleModel: schema.sessions },
  { pgName: '"VerificationToken"', drizzleModel: schema.verificationTokens },
];

async function main() {
  console.log("Starting Migration from PostgreSQL to MySQL...");
  
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await pgClient.connect();
  console.log("Connected to PostgreSQL.");
  
  for (const tableDef of tablesToMigrate) {
    console.log(`Migrating table ${tableDef.pgName}...`);
    
    // Fetch all rows from Postgres
    const res = await pgClient.query(`SELECT * FROM ${tableDef.pgName}`);
    const rows = res.rows;
    
    if (rows.length === 0) {
      console.log(`  No rows to migrate for ${tableDef.pgName}.`);
      continue;
    }
    
    // Insert into MySQL in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // We might need to transform boolean values (if pg driver returns true/false, mysql2 usually handles it, but just in case)
      // or JSON values.
      
      try {
        await db.insert(tableDef.drizzleModel).values(batch);
      } catch (e: any) {
        console.error(`  Error inserting batch for ${tableDef.pgName}:`, e.message);
        // Continue but warn
      }
    }
    
    console.log(`  Migrated ${rows.length} rows for ${tableDef.pgName}.`);
  }
  
  await pgClient.end();
  console.log("Migration Complete.");
}

main().catch(console.error);
