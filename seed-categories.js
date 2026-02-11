import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const categories = [
      { name: 'FCPS', displayName: 'FCPS' },
      { name: 'Medicine', displayName: 'Medicine' },
      { name: 'Surgery', displayName: 'Surgery' },
      { name: 'Pediatrics', displayName: 'Pediatrics' },
      { name: 'Obstetrics', displayName: 'Obstetrics & Gynecology' }
    ];
    
    for (const cat of categories) {
      const existing = await prisma.category.findUnique({ where: { name: cat.name } });
      if (!existing) {
        await prisma.category.create({ data: cat });
        console.log('Created category:', cat.displayName);
      } else {
        console.log('Category already exists:', cat.displayName);
      }
    }
    
    const count = await prisma.category.count();
    console.log('Total categories in database:', count);
  } catch (err) {
    console.error('Error seeding categories:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
