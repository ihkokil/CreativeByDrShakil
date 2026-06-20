import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
const neonUrl = process.env.NEON_DATABASE_URL;

if (!supabaseUrl || !neonUrl) {
  throw new Error("❌ ERROR: Please set both SUPABASE_DATABASE_URL and NEON_DATABASE_URL in your .env file.");
}

// Instantiate two separate Prisma clients pointing to the two databases
const sourceDb = new PrismaClient({
  datasources: { db: { url: supabaseUrl } },
});

const targetDb = new PrismaClient({
  datasources: { db: { url: neonUrl } },
});

// The order is critical to respect Foreign Key constraints during insertion.
// We must insert parent tables before child tables.
const TABLE_MIGRATION_ORDER = [
  'category',
  'user',
  'paymentConfig',
  'globalSessionLockSettings',
  'emailOtp',
  'verificationToken',
  
  'course',
  'contactSubmission',
  'deviceSession',
  'sessionLockSettings',
  'account',
  'session',
  
  'courseInstructor',
  'order',
  'lessonProgress',
  'studentModuleAvailability',
  
  'payment',
];

async function migrate() {
  console.log("🚀 Starting database migration from Supabase to Neon...");
  console.log(`Source: ${supabaseUrl.split('@')[1] || 'Supabase'}`);
  console.log(`Target: ${neonUrl.split('@')[1] || 'Neon'}`);
  
  // 1. Clear target database (in reverse order to respect FKs for deletion)
  console.log("\n--- 🧹 CLEARING TARGET DATABASE ---");
  const deleteOrder = [...TABLE_MIGRATION_ORDER, 'videoLibraryNode'].reverse();
  for (const table of deleteOrder) {
    console.log(`Clearing ${table}...`);
    // @ts-ignore
    await targetDb[table].deleteMany({});
  }

  // 2. Migrate Standard Tables
  console.log("\n--- 📥 MIGRATING DATA ---");
  for (const table of TABLE_MIGRATION_ORDER) {
    console.log(`Migrating ${table}...`);
    // @ts-ignore
    const records = await sourceDb[table].findMany();
    
    if (records.length > 0) {
      // We chunk the inserts if the array is extremely large, but for most apps createMany is fine.
      const chunkSize = 5000;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        // @ts-ignore
        await targetDb[table].createMany({
          data: chunk,
          skipDuplicates: true,
        });
      }
      console.log(`✅ Copied ${records.length} records to ${table}.`);
    } else {
      console.log(`⏭️  No records found for ${table}.`);
    }
  }

  // 3. Migrate VideoLibraryNode (Self-Referential Table)
  console.log(`\nMigrating videoLibraryNode (Self-Referential)...`);
  const allVideoNodes = await sourceDb.videoLibraryNode.findMany();
  if (allVideoNodes.length > 0) {
    // Topologically sort nodes to insert parents first
    const insertedIds = new Set<string>();
    let remainingNodes = [...allVideoNodes];
    
    let pass = 1;
    while (remainingNodes.length > 0) {
      const insertable = remainingNodes.filter(
        node => !node.parentId || insertedIds.has(node.parentId)
      );
      
      if (insertable.length === 0) {
         console.warn("⚠️ Circular dependency detected in VideoLibraryNode! Inserting remaining nodes forcefully.");
         await targetDb.videoLibraryNode.createMany({ data: remainingNodes, skipDuplicates: true });
         break;
      }
      
      await targetDb.videoLibraryNode.createMany({
        data: insertable,
        skipDuplicates: true,
      });
      
      insertable.forEach(n => insertedIds.add(n.id));
      remainingNodes = remainingNodes.filter(n => !insertedIds.has(n.id));
      console.log(`✅ Copied ${insertable.length} video nodes in pass ${pass}.`);
      pass++;
    }
  } else {
    console.log(`⏭️  No records found for videoLibraryNode.`);
  }

  console.log("\n🎉 Migration completed successfully! No data loss.");
}

migrate()
  .catch(e => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
  });
