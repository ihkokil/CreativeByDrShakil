const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function main() { 
  const course = await prisma.course.findFirst({ where: { status: 'published' } }); 
  console.log('typeof:', typeof course.curriculumJson); 
  console.log('isArray:', Array.isArray(course.curriculumJson)); 
  console.log('value:', course.curriculumJson); 
} 

main().catch(console.error).finally(() => prisma.$disconnect());
