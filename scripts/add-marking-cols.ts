import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.SUPABASE_DB_URL && !process.env.DIRECT_URL) {
    dotenv.config({ path: '.env' });
}

const dbUrl = process.env.DIRECT_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
    console.error("Database URL not found in environment variables.");
    process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

async function run() {
    try {
        console.log("Adding marking columns to Quiz table...");
        
        const queries = [
            `ALTER TABLE "Quiz" ADD COLUMN "sbaMarks" REAL DEFAULT 1;`,
            `ALTER TABLE "Quiz" ADD COLUMN "sbaNegative" REAL DEFAULT 0;`,
            `ALTER TABLE "Quiz" ADD COLUMN "tfMarks" REAL DEFAULT 0.2;`,
            `ALTER TABLE "Quiz" ADD COLUMN "tfNegative" REAL DEFAULT 0;`
        ];

        for (const query of queries) {
            try {
                await sql.unsafe(query);
                console.log(`Executed: ${query}`);
            } catch (err: any) {
                if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
                    console.log(`Column already exists, skipping: ${query}`);
                } else {
                    console.error(`Failed to execute: ${query}`);
                    throw err;
                }
            }
        }

        console.log("Reloading PostgREST schema cache...");
        await sql`NOTIFY pgrst, 'reload schema';`;
        console.log("Schema cache reloaded successfully!");
    } catch (err) {
        console.error("Failed to alter table:", err);
    } finally {
        process.exit(0);
    }
}
run();
