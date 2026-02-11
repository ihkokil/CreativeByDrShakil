import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, emailVerified: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  console.log('user_count =', users.length);
  console.table(users);
} catch (error) {
  console.error('Failed to check users:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
