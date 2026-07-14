import { db } from '../src/lib/db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../src/db/schema';

const UPDATES = [
  {
    email: 'demo1@student.com',
    accountCreateDate: new Date('2026-06-09T00:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-10T00:00:00Z').toISOString(),
  },
  {
    email: 'demo2@student.com',
    accountCreateDate: new Date('2026-06-19T00:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-10T00:00:00Z').toISOString(),
  },
  {
    email: 'demo3@student.com',
    accountCreateDate: new Date('2026-06-22T00:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-20T00:00:00Z').toISOString(),
  },
  {
    email: 'demo4@student.com',
    accountCreateDate: new Date('2026-06-19T00:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-30T00:00:00Z').toISOString(),
  },
];

const courseId = '5b769809-293f-4de7-aae2-348488625d47';

async function main() {
  console.log(`Updating dates for specific students in course: ${courseId}`);

  for (const data of UPDATES) {
    console.log(`Processing ${data.email}...`);
    
    // Find the user
    const userResult = await db.select().from(schema.user).where(eq(schema.user.email, data.email));
    if (userResult.length === 0) {
      console.log(`  User ${data.email} not found. Skipping.`);
      continue;
    }
    const user = userResult[0];

    // Update User accountCreateDate
    await db.update(schema.user)
      .set({ createdAt: data.accountCreateDate })
      .where(eq(schema.user.id, user.id));

    // Find the enrollment (order) for this course
    const orderResult = await db.select().from(schema.order)
      .where(and(eq(schema.order.userId, user.id), eq(schema.order.courseId, courseId)));
      
    if (orderResult.length === 0) {
       console.log(`  Enrollment for ${data.email} in course ${courseId} not found. Skipping.`);
    } else {
       // Update Order enrollDate
       await db.update(schema.order)
         .set({ 
            createdAt: data.enrollDate, 
            enrolledAt: data.enrollDate 
          })
         .where(eq(schema.order.id, orderResult[0].id));
       console.log(`  Successfully updated ${data.email}: Account created ${data.accountCreateDate}, Enrolled ${data.enrollDate}`);
    }
  }

  console.log('Update complete!');
}

main()
  .catch((error) => {
    console.error('Failed to update dates:', error);
    process.exit(1);
  });
