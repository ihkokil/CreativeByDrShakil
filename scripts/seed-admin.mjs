import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@creativebds.local';
  const plainPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
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
  console.log('Login email:', email);
  console.log('Login password:', plainPassword);
}

main()
  .catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
