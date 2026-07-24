import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.SUPABASE_DB_URL);

async function run() {
  try {
    console.log("Truncating quiz tables...");
    
    // We use CASCADE to automatically delete dependent rows
    await sql`TRUNCATE TABLE "Quiz", "Question", "QuizAttempt", "AttemptAnswer" CASCADE`;
    
    console.log("Successfully truncated Quiz, Question, QuizAttempt, AttemptAnswer!");
    await sql.end();
  } catch (e) {
    console.error("Error wiping tables:", e);
    await sql.end();
  }
}
run();
