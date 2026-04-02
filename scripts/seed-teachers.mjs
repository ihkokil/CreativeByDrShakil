import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEACHERS = [
  {
    fullName: 'Dr. Shakil Ahmed',
    email: 'dr.shakil@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-001',
  },
  {
    fullName: 'Dr. Rahman',
    email: 'dr.rahman@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-002',
  },
  {
    fullName: 'Dr. Fatima',
    email: 'dr.fatima@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-003',
  },
  {
    fullName: 'Dr. Arif Billah',
    email: 'dr.arif@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-004',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Teacher@12345', 12);

  for (const teacher of TEACHERS) {
    await prisma.user.upsert({
      where: { email: teacher.email },
      update: {
        fullName: teacher.fullName,
        role: 'teacher',
        bmdcNumber: teacher.bmdcNumber,
        passwordHash,
      },
      create: {
        fullName: teacher.fullName,
        email: teacher.email,
        role: 'teacher',
        bmdcNumber: teacher.bmdcNumber,
        passwordHash,
      },
    });
  }

  const syncedTeachers = await prisma.user.findMany({
    where: { role: 'teacher' },
    select: { fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });

  console.log('Teacher sync complete:');
  console.table(syncedTeachers);
}

main()
  .catch((error) => {
    console.error('Failed to seed teachers:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
