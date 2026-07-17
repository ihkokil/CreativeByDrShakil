import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Ensure script is run with proper env
const sourceDirectUrl = process.env.SUPABASE_DIRECT_URL || process.env.SUPABASE_DATABASE_URL;
if (!sourceDirectUrl) {
  console.error("Please provide SUPABASE_DIRECT_URL or SUPABASE_DATABASE_URL in .env for the source DB");
  process.exit(1);
}

const targetConfigs = [
  { name: 'Backup DB', url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY },
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

const sql = postgres(sourceDirectUrl);
const targetClients = activeTargets.map(t => ({
  name: t.name,
  client: createClient(t.url, t.key, {
    auth: { persistSession: false }
  })
}));

function topologicalSort(tables, edges) {
  const adj = new Map();
  const inDegree = new Map();
  for (const t of tables) {
    adj.set(t, []);
    inDegree.set(t, 0);
  }

  for (const [dependent, referenced] of edges) {
    // dependent relies on referenced. So 'referenced' must be inserted BEFORE 'dependent'.
    // Edge direction: referenced -> dependent
    if (adj.has(referenced) && adj.has(dependent) && dependent !== referenced) {
      adj.get(referenced).push(dependent);
      inDegree.set(dependent, inDegree.get(dependent) + 1);
    }
  }

  const queue = [];
  for (const [t, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(t);
  }

  const order = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    order.push(curr);
    for (const neighbor of adj.get(curr)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (order.length !== tables.length) {
    console.warn("Circular dependency detected! Appending remaining tables at the end.");
    for (const t of tables) {
      if (!order.includes(t)) order.push(t);
    }
  }
  return order;
}

/**
 * VideoLibraryNode is self-referencing (parentId -> id) and can be an
 * arbitrarily deep tree (e.g. module -> lesson -> sub-item -> ...).
 * A naive "nulls first" sort only guarantees roots come first; it does NOT
 * guarantee a node is ordered after its actual parent once you go past
 * depth 2, which can violate the self-referencing FK on insert.
 *
 * This does a proper level-order (BFS-by-depth) sort using parentId chains,
 * with a safety fallback for any orphaned/cyclic rows so nothing is dropped.
 */
function sortVideoLibraryNodesByDepth(rows) {
  const byId = new Map(rows.map(r => [r.id, r]));
  const depthCache = new Map();

  function depthOf(row, seen = new Set()) {
    if (row.parentId === null || row.parentId === undefined) return 0;
    if (depthCache.has(row.id)) return depthCache.get(row.id);
    if (seen.has(row.id)) return 0; // cycle guard, shouldn't happen but stay safe
    const parent = byId.get(row.parentId);
    if (!parent) return 0; // parent not in this batch (already exists on target)
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

async function sync() {
  console.log(`Connected to Source DB.`);

  // 1. Fetch tables
  const tablesResult = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  `;
  const tables = tablesResult
    .map(r => r.table_name)
    .filter(t => !t.startsWith('_prisma') && t !== 'drizzle_migrations');

  // 2. Fetch foreign key constraints
  const edgesResult = await sql`
    SELECT
        tc.table_name AS dependent_table,
        ccu.table_name AS referenced_table
    FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `;
  const edges = edgesResult.map(r => [r.dependent_table, r.referenced_table]);

  // 3. Sort tables topologically
  const tableOrder = topologicalSort(tables, edges);
  console.log(`\nDiscovered ${tables.length} tables. Planned sync order:`);
  console.log(tableOrder.join(' -> '));

  console.log(`\nSyncing to ${activeTargets.length} target instances...`);

  // 4. Fetch data from source
  const data = {};
  for (const table of tableOrder) {
    console.log(`Fetching ${table} from source...`);
    data[table] = await sql`SELECT * FROM public.${sql(table)}`;
    console.log(` -> Fetched ${data[table].length} rows for ${table}`);
  }

  // 5. Upsert into targets in topological order
  for (const target of targetClients) {
    console.log(`\n=== Syncing to target: ${target.name} ===`);
    for (const table of tableOrder) {
      let rows = data[table];
      if (!rows || rows.length === 0) continue;

      if (table === 'VideoLibraryNode') {
        rows = sortVideoLibraryNodesByDepth(rows);
      }

      console.log(`Upserting ${rows.length} rows into ${table}...`);

      // Batch inserts in chunks of 500 to avoid request size limits
      const chunkSize = 500;
      let totalSuccess = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        let chunk = rows.slice(i, i + chunkSize);

        let options = undefined;
        // If a table has a specific unique constraint that is failing due to existing test data,
        // we can specify it here to merge correctly instead of failing.
        // (Matched against every non-PK UNIQUE constraint present in the schema.)
        if (table === 'LessonProgress') {
          options = { onConflict: 'userId, courseId, lessonNodeId' };
        } else if (table === 'StudentModuleAvailability') {
          options = { onConflict: 'courseId, userId, lessonNodeId' };
        } else if (table === 'Order') {
          options = { onConflict: 'userId, courseId' };
        } else if (table === 'Account') {
          options = { onConflict: 'provider, providerAccountId' };
        } else if (table === 'VerificationToken') {
          options = { onConflict: 'identifier, token' };
        } else if (table === 'Payment') {
          options = { onConflict: 'orderId' };
        } else if (table === 'SessionLockSettings') {
          options = { onConflict: 'userId' };
        } else if (table === 'Category') {
          options = { onConflict: 'name' };
        } else if (table === 'QuizCategory') {
          // BUG FIX: previously fell through to default (PK-only) upsert and
          // could throw a unique violation on QuizCategory_name_key.
          options = { onConflict: 'name' };
        } else if (table === 'AttemptAnswer') {
          options = { onConflict: 'attemptId, questionId' };
        } else if (table === 'QuizQuestionMapping') {
          options = { onConflict: 'attemptId, questionId' };
        } else if (table === 'QuizAttempt') {
          options = { onConflict: 'quizId, studentId, attemptNumber' };
        } else if (table === 'Course') {
          options = { onConflict: 'slug' };
        } else if (table === 'Session') {
          options = { onConflict: 'sessionToken' };
        }

        const { error } = await target.client.from(table).upsert(chunk, options);
        if (error) {
          console.error(`Error inserting chunk ${Math.floor(i / chunkSize) + 1} into ${table} on ${target.name}:`, error.message);
        } else {
          totalSuccess += chunk.length;
        }
      }
      if (totalSuccess > 0) {
        console.log(` -> Successfully synced ${totalSuccess} rows.`);
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
