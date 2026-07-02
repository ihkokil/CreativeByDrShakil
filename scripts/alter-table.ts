import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DIRECT_URL!, { max: 1 });

async function run() {
    try {
        await sql`ALTER TABLE "VideoLibraryNode" ADD COLUMN IF NOT EXISTS "attachments" jsonb;`;
        console.log("Successfully added attachments column to VideoLibraryNode.");
    } catch (err) {
        console.error("Failed to alter table:", err);
    } finally {
        process.exit(0);
    }
}
run();
