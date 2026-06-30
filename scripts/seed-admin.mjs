import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !plainPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required.');
  }

  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName: 'Platform Admin',
      role: 'admin',
      emailVerified: true,
      passwordHash,
    },
    create: {
      fullName: 'Platform Admin',
      email,
      role: 'admin',
      emailVerified: true,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
    },
  });

  console.log('Admin account ready:');
  console.table([admin]);
}

main()
  .catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
