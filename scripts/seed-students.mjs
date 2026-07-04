import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STUDENTS = [
  {
    fullName: 'Demo Student 1',
    email: 'demo1@student.com',
    accountCreateDate: new Date('2026-06-09T10:00:00Z'),
    enrollDate: new Date('2026-06-10T10:00:00Z'),
  },
  {
    fullName: 'Demo Student 2',
    email: 'demo2@student.com',
    accountCreateDate: new Date('2026-06-19T10:00:00Z'),
    enrollDate: new Date('2026-06-10T10:00:00Z'),
  },
  {
    fullName: 'Demo Student 3',
    email: 'demo3@student.com',
    accountCreateDate: new Date('2026-06-22T10:00:00Z'),
    enrollDate: new Date('2026-06-20T10:00:00Z'),
  },
  {
    fullName: 'Demo Student 4',
    email: 'demo4@student.com',
    accountCreateDate: new Date('2026-06-19T10:00:00Z'),
    enrollDate: new Date('2026-06-30T10:00:00Z'),
  },
];

async function main() {
  const plainPassword = process.env.SEED_STUDENT_PASSWORD;
  if (!plainPassword) {
    throw new Error('SEED_STUDENT_PASSWORD environment variable is required.');
  }

  console.log('Fetching course to enroll students...');
  let course = await prisma.course.findFirst();
  
  if (!course) {
    console.log('No course found. Creating abc-course...');
    course = await prisma.course.create({
      data: {
        title: 'abc-course',
        price: 0,
        slug: 'abc-course',
        duration: '1 year',
      }
    });
  }
  
  console.log(`Using course: ${course.title} (${course.id})`);

  for (const student of STUDENTS) {
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    console.log(`Upserting student ${student.email}...`);
    const dbStudent = await prisma.user.upsert({
      where: { email: student.email },
      update: {
        fullName: student.fullName,
        role: 'student',
        emailVerified: true,
        passwordHash,
        createdAt: student.accountCreateDate,
      },
      create: {
        fullName: student.fullName,
        email: student.email,
        role: 'student',
        emailVerified: true,
        passwordHash,
        createdAt: student.accountCreateDate,
      },
    });

    // Enroll student
    console.log(`Enrolling student ${student.email} in course...`);
    await prisma.order.upsert({
      where: {
        userId_courseId: {
          userId: dbStudent.id,
          courseId: course.id,
        }
      },
      update: {
        status: 'completed',
        totalAmount: 0,
        enrolledAt: student.enrollDate,
        createdAt: student.enrollDate,
      },
      create: {
        userId: dbStudent.id,
        courseId: course.id,
        status: 'completed',
        totalAmount: 0,
        enrolledAt: student.enrollDate,
        createdAt: student.enrollDate,
      }
    });
  }

  console.log('Successfully seeded students and enrollments!');
}

main()
  .catch((error) => {
    console.error('Failed to seed students:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
