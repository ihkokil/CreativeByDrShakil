import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DIRECT_URL!, { max: 1 });

async function executeSqlFile(filePath: string) {
  console.log(`Reading migration: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  // Drizzle splits statements using "--> statement-breakpoint"
  const statements = content.split('--> statement-breakpoint');
  
  for (let statement of statements) {
    statement = statement.trim();
    if (!statement) continue;
    
    // Remove comments
    statement = statement.split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
      
    if (!statement) continue;
    
    try {
      console.log(`Executing statement:\n${statement}\n`);
      await sql.unsafe(statement);
      console.log("Success.");
    } catch (err: any) {
      console.warn(`Warning/Error executing statement: ${err.message}`);
      // If it's a "column already exists" or "relation already exists" error, we can ignore it
      if (err.message.includes('already exists') || err.message.includes('already a member')) {
        console.log("Skipping as it already exists.");
      } else {
        throw err;
      }
    }
  }
}

async function run() {
  try {
    const file2 = path.join(process.cwd(), 'drizzle', '0002_thick_taskmaster.sql');
    await executeSqlFile(file2);
    
    const file3 = path.join(process.cwd(), 'drizzle', '0003_lyrical_chronomancer.sql');
    await executeSqlFile(file3);
    
    console.log("All migrations executed successfully.");
  } catch (err) {
    console.error("Migration execution failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
