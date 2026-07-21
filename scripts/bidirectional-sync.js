import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const oldUrl = process.env.OLD_PROD_URL;
const oldKey = process.env.OLD_PROD_KEY;
const newUrl = process.env.SUPABASE_URL;
const newKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const TABLES_TO_SYNC = [
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

// Tables that have an updatedAt field for conflict resolution
const TABLES_WITH_TIMESTAMPS = new Set([
    'User',
    'Course',
    'Quiz',
    'Question',
    'VideoLibraryNode',
    'Order',
    'Payment',
    'LessonProgress',
    'QuizAttempt',
]);

// Conflict resolution keys per table
const CONFLICT_KEYS = {
    User: 'email',
    Category: 'name',
    QuizCategory: 'name',
    Course: 'slug',
    Order: 'userId, courseId',
    Payment: 'orderId',
    LessonProgress: 'userId, courseId, lessonNodeId',
    QuizAttempt: 'quizId, studentId, attemptNumber',
    AttemptAnswer: 'attemptId, questionId',
    QuizQuestionMapping: 'attemptId, questionId',
    StudentModuleAvailability: 'courseId, userId, lessonNodeId',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Merges two arrays of rows by id, keeping the newer record when both
 * databases have the same row and the table has an updatedAt field.
 * If there is no updatedAt, the target (destination) row wins to be safe.
 */
function mergeRows(sourceRows, targetRows, table) {
    const merged = new Map();
    const hasTimestamp = TABLES_WITH_TIMESTAMPS.has(table);

    // Seed with target rows first
    for (const row of targetRows) {
        merged.set(row.id, row);
    }

    // Overlay source rows, respecting timestamps when available
    for (const sourceRow of sourceRows) {
        const existing = merged.get(sourceRow.id);

        if (!existing) {
            // Row only exists in source — always take it
            merged.set(sourceRow.id, sourceRow);
            continue;
        }

        if (hasTimestamp && sourceRow.updatedAt && existing.updatedAt) {
            const sourceTime = new Date(sourceRow.updatedAt).getTime();
            const targetTime = new Date(existing.updatedAt).getTime();
            if (sourceTime > targetTime) {
                merged.set(sourceRow.id, sourceRow);
            }
            // else keep target (already in map)
        }
        // No timestamp → keep target (already in map)
    }

    return [...merged.values()];
}

async function fetchAll(client, table) {
    const { data, error } = await client.from(table).select('*');
    if (error) {
        if (error.code === '42P01') return { rows: null, missing: true };
        return { rows: null, missing: false, error };
    }
    return { rows: data ?? [], missing: false };
}

async function pushChunks(client, table, rows, chunkSize = 500) {
    const conflictKey = CONFLICT_KEYS[table];
    const options = conflictKey ? { onConflict: conflictKey } : undefined;

    let totalSuccess = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await client.from(table).upsert(chunk, options);

        if (error) {
            console.error(
                `  ❌ Error pushing chunk ${Math.floor(i / chunkSize) + 1} to ${table}:`,
                error.message
            );
        } else {
            totalSuccess += chunk.length;
        }
    }

    return totalSuccess;
}

// ─── Core sync ──────────────────────────────────────────────────────────────

async function syncTable(table) {
    console.log(`\n--- Syncing ${table} ---`);

    // 1. Fetch from both sides
    const [oldResult, newResult] = await Promise.all([
        fetchAll(oldClient, table),
        fetchAll(newClient, table),
    ]);

    if (oldResult.missing && newResult.missing) {
        console.log(`  ⚠️  Table ${table} missing from both DBs. Skipping...`);
        return;
    }

    if (oldResult.missing) {
        console.log(`  ⚠️  Table ${table} missing from old DB. Skipping...`);
        return;
    }

    if (newResult.missing) {
        console.log(`  ⚠️  Table ${table} missing from new DB. Skipping...`);
        return;
    }

    if (oldResult.error) {
        console.error(`  ❌ Error fetching ${table} from old DB:`, oldResult.error.message);
        return;
    }

    if (newResult.error) {
        console.error(`  ❌ Error fetching ${table} from new DB:`, newResult.error.message);
        return;
    }

    const oldRows = oldResult.rows;
    const newRows = newResult.rows;

    if (oldRows.length === 0 && newRows.length === 0) {
        console.log(`  No rows in either DB. Skipping...`);
        return;
    }

    console.log(`  Old DB: ${oldRows.length} rows | New DB: ${newRows.length} rows`);

    // 2. Build merged set (newest wins for timestamped tables)
    const mergedRows =
        table === 'VideoLibraryNode'
            ? sortVideoLibraryNodesByDepth(mergeRows(oldRows, newRows, table))
            : mergeRows(oldRows, newRows, table);

    console.log(`  Merged: ${mergedRows.length} unique rows`);

    // 3. Push merged set to both DBs
    const [oldSuccess, newSuccess] = await Promise.all([
        pushChunks(oldClient, table, mergedRows),
        pushChunks(newClient, table, mergedRows),
    ]);

    console.log(`  ✅ Old DB ← ${oldSuccess} rows | New DB ← ${newSuccess} rows`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function sync() {
    console.log(`Starting bidirectional sync between:`);
    console.log(`  OLD: ${oldUrl}`);
    console.log(`  NEW: ${newUrl}\n`);

    for (const table of TABLES_TO_SYNC) {
        await syncTable(table);
    }

    console.log(`\n🎉 Bidirectional sync complete!`);
}

sync().catch(console.error);