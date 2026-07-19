import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const oldUrl = process.env.OLD_PROD_URL;
const oldKey = process.env.OLD_PROD_KEY; // Service role key of old prod

const newUrl = process.env.SUPABASE_URL; // Primary DB
const newKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Primary DB Key

if (!oldUrl || !oldKey) {
  console.error("Please provide OLD_PROD_URL and OLD_PROD_KEY in .env");
  process.exit(1);
}

if (!newUrl || !newKey) {
  console.error("Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const oldClient = createClient(oldUrl, oldKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const newClient = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Full topological order for migrating all relevant tables, skipping dead NextAuth tables
const TABLES_TO_MIGRATE = [
  'User',
  'Category',
  'QuizCategory',
  'Course',
  'CourseInstructor',
  'Quiz',
  'Question',
  'VideoLibraryNode',
  'Order',
  'Payment',
  'PaymentConfig',
  'ContactSubmission',
  'LessonProgress',
  'QuizAttempt',
  'AttemptAnswer',
  'QuizQuestionMapping',
  'StudentModuleAvailability',
  'EmailOtp'
];

function sortVideoLibraryNodesByDepth(rows) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const depthCache = new Map();

  function depthOf(row, seen = new Set()) {
    if (row.parentId === null || row.parentId === undefined) return 0;
    if (depthCache.has(row.id)) return depthCache.get(row.id);
    if (seen.has(row.id)) return 0; 
    const parent = byId.get(row.parentId);
    if (!parent) return 0; 
    seen.add(row.id);
    const d = 1 + depthOf(parent, seen);
    depthCache.set(row.id, d);
    return d;
  }

  for (const row of rows) {
    depthCache.set(row.id, depthOf(row));
  }

  return [...rows].sort((a, b) => depthCache.get(a.id) - depthCache.get(b.id));
}

async function migrate() {
  console.log(`Starting migration from ${oldUrl} to Primary DB ${newUrl}...`);

  for (const table of TABLES_TO_MIGRATE) {
    console.log(`\n--- Migrating ${table} ---`);
    
    // Fetch from Old DB
    const { data: rows, error: fetchError } = await oldClient.from(table).select('*');
    if (fetchError) {
      if (fetchError.code === '42P01') {
        console.log(`⚠️ Table ${table} does not exist in old DB. Skipping...`);
        continue;
      }
      console.error(`❌ Error fetching ${table}:`, fetchError.message);
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`No rows found in ${table}. Skipping...`);
      continue;
    }

    let insertRows = rows;
    if (table === 'VideoLibraryNode') {
      insertRows = sortVideoLibraryNodesByDepth(rows);
    }

    console.log(`Found ${insertRows.length} rows. Pushing to Primary DB...`);

    const chunkSize = 500;
    let totalSuccess = 0;

    for (let i = 0; i < insertRows.length; i += chunkSize) {
      const chunk = insertRows.slice(i, i + chunkSize);

      let options = undefined;
      // Define unique conflicts to allow safe re-runs of the migration script
      if (table === 'User') options = { onConflict: 'email' };
      else if (table === 'Category') options = { onConflict: 'name' };
      else if (table === 'QuizCategory') options = { onConflict: 'name' };
      else if (table === 'Course') options = { onConflict: 'slug' };
      else if (table === 'Order') options = { onConflict: 'userId, courseId' };
      else if (table === 'Payment') options = { onConflict: 'orderId' };
      else if (table === 'LessonProgress') options = { onConflict: 'userId, courseId, lessonNodeId' };
      else if (table === 'QuizAttempt') options = { onConflict: 'quizId, studentId, attemptNumber' };
      else if (table === 'AttemptAnswer') options = { onConflict: 'attemptId, questionId' };
      else if (table === 'QuizQuestionMapping') options = { onConflict: 'attemptId, questionId' };
      else if (table === 'StudentModuleAvailability') options = { onConflict: 'courseId, userId, lessonNodeId' };

      const { error: pushError } = await newClient.from(table).upsert(chunk, options);
      if (pushError) {
        console.error(`❌ Error inserting chunk ${Math.floor(i / chunkSize) + 1} into ${table}:`, pushError.message);
      } else {
        totalSuccess += chunk.length;
      }
    }

    console.log(`✅ Successfully migrated ${totalSuccess} rows to ${table}.`);
  }

  console.log(`\n🎉 Migration Complete! Your Primary DB now contains all old production data.`);
}

migrate().catch(console.error);
