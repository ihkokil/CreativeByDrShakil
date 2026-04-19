import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables = [
    'user',
    'course',
    'category',
    'order',
    'payment',
    'coupon',
    'contactSubmission',
    'videoLibraryNode'
  ];

  console.log('--- Database Audit ---');
  for (const table of tables) {
    try {
      // @ts-expect-error: dynamic key access
      const count = await prisma[table].count();
      console.log(`${table}: ${count} records`);
    } catch (error) {
      console.log(`${table}: Error fetching count`);
    }
  }
  
  const admins = await prisma.user.count({ where: { role: 'admin' } });
  const teachers = await prisma.user.count({ where: { role: 'teacher' } });
  const students = await prisma.user.count({ where: { role: 'student' } });
  
  console.log('\n--- User Breakdown ---');
  console.log(`Admins: ${admins}`);
  console.log(`Teachers: ${teachers}`);
  console.log(`Students: ${students}`);

  const publishedCourses = await prisma.course.count({ where: { status: 'published' } });
  console.log(`\nPublished Courses: ${publishedCourses}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
