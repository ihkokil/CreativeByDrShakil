import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.DIRECT_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function run() {
  const courses = await db.select().from(schema.course).where(eq(schema.course.slug, 'basics'));
  console.log(courses[0].curriculumJson);
  process.exit(0);
}
run();
