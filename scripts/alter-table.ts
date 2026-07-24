import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });

async function run() {
    try {
        console.log("Checking and fixing QuestionType enum...");
        // This will add 'sba', 'mcq', 'true_false' if they don't exist (requires catching errors if they do, or just executing).
        // Postgres doesn't easily support ADD VALUE IF NOT EXISTS inside a transaction block, 
        // so we just catch errors and ignore them.
        const types = ['sba', 'mcq', 'true_false'];
        for (const type of types) {
            try {
                await sql`ALTER TYPE "QuestionType" ADD VALUE ${type};`;
                console.log(`Added '${type}' to QuestionType enum.`);
            } catch (err: any) {
                // Ignore "already exists" errors
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
