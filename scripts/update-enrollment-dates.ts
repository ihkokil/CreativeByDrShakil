import { db } from '../src/lib/db';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../src/db/schema';

async function main() {
  console.log('Connecting to database...');

  // The target date: 12 June, 2026
  const targetDate = new Date("2026-06-12T00:00:00.000Z").toISOString();

  console.log(`Setting student enrollment dates to: ${targetDate}`);

  // Fetch student IDs beforehand
  const students = await db.select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, 'student'));

  if (students.length > 0) {
    const studentIds = students.map(u => u.id);

    // 1. Update the 'createdAt' property of all users with role 'student'
    await db.update(schema.user)
      .set({ createdAt: targetDate })
      .where(eq(schema.user.role, 'student'));

    console.log(`Updated ${students.length} students' profiles (User.createdAt).`);
    
    // 2. Update the 'createdAt' property of all orders (which represents course enrollment)
    await db.update(schema.order)
      .set({ createdAt: targetDate, enrolledAt: targetDate })
      .where(inArray(schema.order.userId, studentIds));

    console.log(`Updated course enrollments (Order.createdAt & enrolledAt) for the students.`);
  } else {
    console.log(`Updated 0 course enrollments.`);
  }

  console.log('Done!');
}

main()
  .catch((error) => {
    console.error('Failed to update enrollment dates:', error);
    process.exit(1);
  });
