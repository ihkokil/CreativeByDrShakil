import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CLINICAL_COURSE_SLUGS = [
  'medicine-and-allied',
  'surgery-and-allied',
  'gynae-and-obsetrics',
  'radiology',
  'dermatology',
  'basics'
];

const CLINICAL_COURSE_TITLES = [
  'Medicine and Allied',
  'Surgery and Allied',
  'Gynae& Obstetrics',
  'Radiology',
  'Dermatology',
  'Basics'
];

async function main() {
  console.log('Connecting to database...');
  
  // 1. Find the target courses
  const coursesToDelete = await prisma.course.findMany({
    where: {
      OR: [
        { slug: { in: CLINICAL_COURSE_SLUGS } },
        { title: { in: CLINICAL_COURSE_TITLES } }
      ]
    },
    select: {
      id: true,
      title: true,
      slug: true
    }
  });

  if (coursesToDelete.length === 0) {
    console.log('No matching predefined courses found in the database.');
    return;
  }

  const courseIds = coursesToDelete.map(c => c.id);
  console.log(`Found ${coursesToDelete.length} courses to delete:`);
  coursesToDelete.forEach(c => console.log(` - ${c.title} (${c.slug}) [ID: ${c.id}]`));

  console.log('\nExecuting deletion...');

  // 2. Delete Order records (will cascade delete related Payment records)
  const deletedOrders = await prisma.order.deleteMany({
    where: {
      courseId: { in: courseIds }
    }
  });
  console.log(`Deleted ${deletedOrders.count} order records (and associated payments).`);

  // 3. Delete Course records (will cascade delete LessonProgress, StudentModuleAvailability, CourseInstructor)
  const deletedCourses = await prisma.course.deleteMany({
    where: {
      id: { in: courseIds }
    }
  });
  console.log(`Deleted ${deletedCourses.count} course records (and associated instructors/progress/overrides).`);

  console.log('\nDatabase cleanup complete!');
}

main()
  .catch((e) => {
    console.error('Error executing cleanup script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
