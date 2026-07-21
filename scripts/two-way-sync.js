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

function getConflictOptions(table) {
  if (table === 'User') return { onConflict: 'email' };
  if (table === 'Category') return { onConflict: 'name' };
  if (table === 'QuizCategory') return { onConflict: 'name' };
  if (table === 'Course') return { onConflict: 'slug' };
  if (table === 'Order') return { onConflict: 'userId, courseId' };
  if (table === 'Payment') return { onConflict: 'orderId' };
  if (table === 'LessonProgress') return { onConflict: 'userId, courseId, lessonNodeId' };
  if (table === 'QuizAttempt') return { onConflict: 'quizId, studentId, attemptNumber' };
  if (table === 'AttemptAnswer') return { onConflict: 'attemptId, questionId' };
  if (table === 'QuizQuestionMapping') return { onConflict: 'attemptId, questionId' };
  if (table === 'StudentModuleAvailability') return { onConflict: 'courseId, userId, lessonNodeId' };
  return undefined;
}

async function fetchAll(client, table) {
  let allRows = [];
  let from = 0;
  const size = 1000;
  let fetchMore = true;

  while (fetchMore) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + size - 1);
      
    if (error) {
      if (error.code === '42P01') {
        console.log(`⚠️ Table ${table} does not exist. Skipping...`);
        return [];
      }
      throw error;
    }
    
    if (data.length > 0) {
      allRows = allRows.concat(data);
      from += size;
      if (data.length < size) fetchMore = false;
    } else {
      fetchMore = false;
    }
  }
  return allRows;
}

async function syncChunks(client, table, rows, dbName) {
  if (rows.length === 0) return;
  const chunkSize = 500;
  let successCount = 0;
  const options = getConflictOptions(table);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).upsert(chunk, options);
    if (error) {
      console.error(`❌ Error inserting to ${dbName} for ${table}:`, error.message);
    } else {
      successCount += chunk.length;
    }
  }
  console.log(`✅ Upserted ${successCount} rows into ${dbName} (${table}).`);
}

async function sync() {
  console.log(`Starting TWO-WAY migration between Old DB (${oldUrl}) and Primary DB (${newUrl})...\n`);

  for (const table of TABLES_TO_MIGRATE) {
    console.log(`\n--- Synchronizing ${table} ---`);
    
    try {
      const [oldRows, newRows] = await Promise.all([
        fetchAll(oldClient, table),
        fetchAll(newClient, table)
      ]);

      console.log(`Fetched ${oldRows.length} rows from OLD, ${newRows.length} rows from NEW.`);

      if (oldRows.length === 0 && newRows.length === 0) continue;

      const oldMap = new Map(oldRows.map(r => [r.id, r]));
      const newMap = new Map(newRows.map(r => [r.id, r]));

      let pushToNew = [];
      let pushToOld = [];

      // 1. Find what's in OLD but not NEW, or updated more recently in OLD
      for (const oldRow of oldRows) {
        const newRow = newMap.get(oldRow.id);
        if (!newRow) {
          pushToNew.push(oldRow); // Missing in NEW
        } else if (oldRow.updatedAt && newRow.updatedAt) {
          if (new Date(oldRow.updatedAt) > new Date(newRow.updatedAt)) {
            pushToNew.push(oldRow); // OLD is newer
          }
        }
      }

      // 2. Find what's in NEW but not OLD, or updated more recently in NEW
      for (const newRow of newRows) {
        const oldRow = oldMap.get(newRow.id);
        if (!oldRow) {
          pushToOld.push(newRow); // Missing in OLD
        } else if (oldRow.updatedAt && newRow.updatedAt) {
          if (new Date(newRow.updatedAt) > new Date(oldRow.updatedAt)) {
            pushToOld.push(newRow); // NEW is newer
          }
        }
      }

      // Preserve hierarchical structure for VideoLibraryNode
      if (table === 'VideoLibraryNode') {
        pushToNew = sortVideoLibraryNodesByDepth(pushToNew);
        pushToOld = sortVideoLibraryNodesByDepth(pushToOld);
      }

      console.log(`Calculated sync payload: ${pushToNew.length} -> NEW DB | ${pushToOld.length} -> OLD DB`);

      // 3. Upsert payloads
      await Promise.all([
        syncChunks(newClient, table, pushToNew, 'NEW DB'),
        syncChunks(oldClient, table, pushToOld, 'OLD DB')
      ]);

    } catch (err) {
      console.error(`❌ Unexpected error processing ${table}:`, err.message);
    }
  }

  console.log(`\n🎉 Two-way synchronization complete!`);
}

sync().catch(console.error);
