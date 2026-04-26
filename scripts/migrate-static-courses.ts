import { PrismaClient } from '@prisma/client';
import { COURSES, INSTRUCTORS } from '../src/constants/courses';

const prisma = new PrismaClient();

// Helper to create a unique node ID
function createNodeId(prefix = 'node') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

async function main() {
  console.log('🚀 Starting course migration...');

  // 1. Map Teachers
  const teacherMapping: Record<string, string> = {
    dr_shakil: 'cmnq6jcpm0000l705rxvhydbm', // Dr. Nahid Akhter Shakil (Prod email)
    dr_rahman: 'cmnq1kjvi0001gw08e3o4med2',
    dr_fatima: 'cmnq1kl260002gw08yh1vz5n5',
    dr_arif: 'cmnq1km1k0003gw08a69639fc',
  };

  // 2. Process Courses
  for (const sc of COURSES) {
    console.log(`\n📦 Processing: ${sc.title}`);

    // Parse Price
    let price = 0;
    if (typeof sc.price === 'string' && sc.price !== 'Free') {
      price = parseFloat(sc.price.replace(/[^\d.]/g, '')) || 0;
    }
    let salePrice = null;
    if (sc.originalPrice && sc.originalPrice !== 'Free') {
      salePrice = price;
      price = parseFloat(sc.originalPrice.replace(/[^\d.]/g, '')) || 0;
    }

    // Convert Curriculum to Builder JSON
    const curriculumNodes = (sc.curriculum || []).map((m) => ({
      id: createNodeId('mod'),
      title: m.title,
      type: 'folder',
      children: m.lessons.map((l) => ({
        id: createNodeId('les'),
        title: l.title,
        type: 'youtube',
        duration: l.duration,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
      })),
    }));

    // Instructor IDs
    const mainTeacherId = teacherMapping[sc.mainInstructor.id] || null;
    const subTeacherIds = (sc.subInstructors || [])
      .map((si) => teacherMapping[si.id])
      .filter(Boolean);

    // Prepare Create/Update Payload
    const courseData: any = {
      title: sc.title,
      slug: sc.slug,
      price: price,
      salePrice: salePrice,
      instructor: sc.mainInstructor.name,
      teacherId: mainTeacherId,
      duration: sc.duration || '6 Months',
      description: sc.description || sc.title,
      overview: sc.description || null,
      learningOutcomes: (sc.learningObjectives || []).join('\n'),
      language: sc.language || 'English / Bengali',
      status: 'published',
      publishedAt: new Date(),
      curriculumJson: curriculumNodes,
      isFeatured: sc.id === 1 || sc.slug.includes('internal-medicine'), // Feature the first one for the UI
    };

    // Upsert Course
    const course = await prisma.course.upsert({
      where: { slug: sc.slug },
      update: courseData,
      create: courseData,
    });

    // Sync Instructors Relation
    // First clear existing
    await prisma.courseInstructor.deleteMany({ where: { courseId: course.id } });
    
    // Add Main
    await prisma.courseInstructor.create({
      data: {
        courseId: course.id,
        name: sc.mainInstructor.name,
        designation: sc.mainInstructor.role,
        sortOrder: 0,
      }
    });

    // Add Subs
    const subInstructors = sc.subInstructors || [];
    for (let i = 0; i < subInstructors.length; i++) {
        const si = subInstructors[i];
        await prisma.courseInstructor.create({
            data: {
                courseId: course.id,
                name: si.name,
                designation: si.role,
                sortOrder: i + 1,
            }
        });
    }

    console.log(`✅ Migrated: ${course.slug} (ID: ${course.id})`);
  }

  console.log('\n✨ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
