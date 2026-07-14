import { db } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
dotenv.config({ path: '.env.local' });

const STUDENTS = [
  {
    fullName: 'Demo Student 1',
    email: 'demo1@student.com',
    accountCreateDate: new Date('2026-06-09T10:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-10T10:00:00Z').toISOString(),
  },
  {
    fullName: 'Demo Student 2',
    email: 'demo2@student.com',
    accountCreateDate: new Date('2026-06-19T10:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-10T10:00:00Z').toISOString(),
  },
  {
    fullName: 'Demo Student 3',
    email: 'demo3@student.com',
    accountCreateDate: new Date('2026-06-22T10:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-20T10:00:00Z').toISOString(),
  },
  {
    fullName: 'Demo Student 4',
    email: 'demo4@student.com',
    accountCreateDate: new Date('2026-06-19T10:00:00Z').toISOString(),
    enrollDate: new Date('2026-06-30T10:00:00Z').toISOString(),
  },
];

async function main() {
  const plainPassword = process.env.SEED_STUDENT_PASSWORD;
  if (!plainPassword) {
    throw new Error('SEED_STUDENT_PASSWORD environment variable is required.');
  }

  const courseId = '5b769809-293f-4de7-aae2-348488625d47';
  console.log(`Enrolling students in course: ${courseId}`);

  for (const student of STUDENTS) {
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    console.log(`Creating student ${student.email}...`);
    // Delete if exists first to avoid complex upsert with Drizzle
    await db.delete(schema.user).where(eq(schema.user.email, student.email));
    
    const studentId = `usr_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await db.insert(schema.user).values({
      id: studentId,
      fullName: student.fullName,
      email: student.email,
      role: 'student',
      emailVerified: true,
      passwordHash,
      createdAt: student.accountCreateDate,
    });
    
    const dbStudent = { id: studentId };

    // Delete existing orders for this student
    await db.delete(schema.order).where(eq(schema.order.userId, dbStudent.id));
    
    console.log(`Enrolling student ${student.email} in course ${courseId}`);
    await db.insert(schema.order).values({
      id: `ord_${Date.now()}_${Math.floor(Math.random()*10000)}`,
      userId: dbStudent.id,
      courseId: courseId,
      status: 'completed',
      totalAmount: 0,
      enrolledAt: student.enrollDate,
      createdAt: student.enrollDate,
    });
  }

  console.log('Successfully seeded students and enrolled them in the requested course!');
}

main()
  .catch((error) => {
    console.error('Failed to seed students:', error);
    process.exit(1);
  });
