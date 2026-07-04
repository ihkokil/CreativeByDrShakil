import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEACHERS = [
  {
    fullName: 'Dr. Nahid Akhter Shakil',
    email: 'dr.shakil@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-001',
    designation: 'Senior Surgical Consultant',
    institution: 'Creative By Dr Shakil Academy',
    degrees: 'MBBS, FCPS (Surgery)',
    profileImage: '/placeholder.svg',
  },
  {
    fullName: 'Dr. Rahman',
    email: 'dr.rahman@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-002',
    designation: 'Internal Medicine Expert',
    institution: 'Creative By Dr Shakil Academy',
    degrees: 'MBBS, MD (Medicine)',
    profileImage: '/placeholder.svg',
  },
  {
    fullName: 'Dr. Fatima',
    email: 'dr.fatima@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-003',
    designation: 'Pediatrics Specialist',
    institution: 'Creative By Dr Shakil Academy',
    degrees: 'MBBS, FCPS (Pediatrics)',
    profileImage: '/placeholder.svg',
  },
  {
    fullName: 'Dr. Arif Billah',
    email: 'dr.arif@creativebds.local',
    bmdcNumber: 'BMDC-TEACHER-004',
    designation: 'Gynae & Obs Specialist',
    institution: 'Creative By Dr Shakil Academy',
    degrees: 'MBBS, FCPS (OBGYN)',
    profileImage: '/placeholder.svg',
  },
];

async function main() {
  const plainPassword = process.env.SEED_TEACHER_PASSWORD;
  if (!plainPassword) {
    throw new Error('SEED_TEACHER_PASSWORD environment variable is required.');
  }
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  for (const teacher of TEACHERS) {
    await prisma.user.upsert({
      where: { email: teacher.email },
      update: {
        fullName: teacher.fullName,
        role: 'teacher',
        emailVerified: true,
        bmdcNumber: teacher.bmdcNumber,
        designation: teacher.designation,
        institution: teacher.institution,
        degrees: teacher.degrees,
        profileImage: teacher.profileImage,
        passwordHash,
      },
      create: {
        fullName: teacher.fullName,
        email: teacher.email,
        role: 'teacher',
        emailVerified: true,
        bmdcNumber: teacher.bmdcNumber,
        designation: teacher.designation,
        institution: teacher.institution,
        degrees: teacher.degrees,
        profileImage: teacher.profileImage,
        passwordHash,
      },
    });
  }

  const syncedTeachers = await prisma.user.findMany({
    where: { role: 'teacher' },
    select: { fullName: true, email: true, designation: true, institution: true },
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
