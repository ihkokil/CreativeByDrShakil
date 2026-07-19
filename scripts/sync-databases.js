import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// We connect exclusively over HTTPS using Supabase JS. No TCP drivers required.
const sourceUrl = process.env.SUPABASE_URL;
const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sourceUrl || !sourceKey) {
  console.error("Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env for the source DB");
  process.exit(1);
}

const targetConfigs = [
  { name: 'Instance 1', url: process.env.SUPABASE_URL_1, key: process.env.SUPABASE_SERVICE_ROLE_KEY_1 },
  { name: 'Instance 2', url: process.env.SUPABASE_URL_2, key: process.env.SUPABASE_SERVICE_ROLE_KEY_2 },
  { name: 'Instance 3', url: process.env.SUPABASE_URL_3, key: process.env.SUPABASE_SERVICE_ROLE_KEY_3 },
  { name: 'Instance 4', url: process.env.SUPABASE_URL_4, key: process.env.SUPABASE_SERVICE_ROLE_KEY_4 },
  { name: 'Instance 5', url: process.env.SUPABASE_URL_5, key: process.env.SUPABASE_SERVICE_ROLE_KEY_5 },
];

const activeTargets = targetConfigs.filter(t => t.url && t.key);
if (activeTargets.length === 0) {
  console.error("No target DB configurations found in .env");
  process.exit(1);
}

const sourceClient = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const targetClients = activeTargets.map(t => ({
  name: t.name,
  client: createClient(t.url, t.key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}));

/**
 * Hardcoded topological order of Category B tables.
 * Must insert in this exact order to satisfy foreign keys.
 */
const CATEGORY_B_TABLES = [
  'Category',
  'QuizCategory',
  'Course',
  'CourseInstructor',
  'Quiz',
  'Question',
  'VideoLibraryNode'
];

/**
 * Same level-order sorting as before, to satisfy self-referencing FKs.
 */
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

async function fetchTableData(table) {
  const { data, error } = await sourceClient.from(table).select('*');
  if (error) {
    throw new Error(`Error fetching ${table}: ${error.message}`);
  }
  return data || [];
}

async function sync() {
  console.log(`Connected to Source DB (Backup DB).`);
  console.log(`\nSyncing to ${activeTargets.length} target instances...`);

  // 1. Fetch all Category B data from the Backup DB
  const data = {};
  for (const table of CATEGORY_B_TABLES) {
    console.log(`Fetching ${table} from source...`);
    data[table] = await fetchTableData(table);
    console.log(` -> Fetched ${data[table].length} rows for ${table}`);
  }

  // 2. Identify required Users to satisfy foreign keys
  // We ONLY fetch users that are actively referenced as teachers or quiz creators.
  const requiredUserIds = new Set();
  
  if (data['Course']) {
    for (const c of data['Course']) {
      if (c.teacherId) requiredUserIds.add(c.teacherId);
    }
  }
  if (data['Quiz']) {
    for (const q of data['Quiz']) {
      if (q.createdBy) requiredUserIds.add(q.createdBy);
    }
  }

  let requiredUsers = [];
  if (requiredUserIds.size > 0) {
    console.log(`\nFetching ${requiredUserIds.size} required Users (Teachers/Admins) to satisfy foreign keys...`);
    const { data: userData, error: userError } = await sourceClient
      .from('User')
      .select('*')
      .in('id', Array.from(requiredUserIds));
      
    if (userError) {
      throw new Error(`Error fetching required users: ${userError.message}`);
    }
    requiredUsers = userData || [];
    console.log(` -> Fetched ${requiredUsers.length} required User rows.`);
  }

  // Define sync sequence including the selective User payload before Course/Quiz
  const syncSequence = [
    { table: 'Category', rows: data['Category'] },
    { table: 'QuizCategory', rows: data['QuizCategory'] },
    { table: 'User', rows: requiredUsers }, // Safe selective sync
    { table: 'Course', rows: data['Course'] },
    { table: 'CourseInstructor', rows: data['CourseInstructor'] },
    { table: 'Quiz', rows: data['Quiz'] },
    { table: 'Question', rows: data['Question'] },
    { table: 'VideoLibraryNode', rows: sortVideoLibraryNodesByDepth(data['VideoLibraryNode']) }
  ];

  // 3. Upsert into targets
  for (const target of targetClients) {
    console.log(`\n=== Syncing to target: ${target.name} ===`);
    
    for (const step of syncSequence) {
      const table = step.table;
      const rows = step.rows;
      
      if (!rows || rows.length === 0) continue;

      console.log(`Upserting ${rows.length} rows into ${table}...`);

      const chunkSize = 500;
      let totalSuccess = 0;
      
      for (let i = 0; i < rows.length; i += chunkSize) {
        let chunk = rows.slice(i, i + chunkSize);

        // Define specific unique conflict identifiers
        let options = undefined;
        if (table === 'Category') {
          options = { onConflict: 'name' };
        } else if (table === 'QuizCategory') {
          options = { onConflict: 'name' };
        } else if (table === 'Course') {
          options = { onConflict: 'slug' };
        }

        const { error } = await target.client.from(table).upsert(chunk, options);
        if (error) {
          console.error(`Error inserting chunk ${Math.floor(i / chunkSize) + 1} into ${table} on ${target.name}:`, error.message);
        } else {
          totalSuccess += chunk.length;
        }
      }
      if (totalSuccess > 0) {
        console.log(` -> Successfully synced ${totalSuccess} rows to ${table}.`);
      }
    }
  }

  console.log('\n✅ Sync completed successfully!');
  process.exit(0);
}

sync().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
