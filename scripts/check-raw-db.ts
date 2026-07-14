import { db } from '../src/lib/db';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const courses = await db.select().from(schema.course).where(eq(schema.course.slug, 'basics'));
  console.log(courses[0].curriculumJson);
  process.exit(0);
}
run();
