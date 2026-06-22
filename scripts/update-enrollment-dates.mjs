import { PrismaClient } from '@prisma/client';

// Add your DB credentials here before running the script
const NEON_DATABASE_URL = "YOUR_NEON_DATABASE_URL_HERE";
const NEON_DIRECT_URL = "YOUR_NEON_DIRECT_URL_HERE";

// Initialize PrismaClient with the provided URLs
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: NEON_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Connecting to database...');

  // The target date: 12 June, 2026
  // You can adjust the exact time/timezone here if needed
  const targetDate = new Date("2026-06-12T00:00:00.000Z");

  console.log(`Setting student enrollment dates to: ${targetDate.toISOString()}`);

  // 1. Update the 'createdAt' property of all users with role 'student'
  const updatedUsers = await prisma.user.updateMany({
    where: {
      role: 'student',
    },
    data: {
      createdAt: targetDate,
    },
  });

  console.log(`Updated ${updatedUsers.count} students' profiles (User.createdAt).`);

  // 2. Update the 'createdAt' property of all orders (which represents course enrollment)
  const updatedOrders = await prisma.order.updateMany({
    where: {
      user: {
        role: 'student',
      },
    },
    data: {
      createdAt: targetDate,
    },
  });

  console.log(`Updated ${updatedOrders.count} course enrollments (Order.createdAt).`);

  console.log('Done!');
}

main()
  .catch((error) => {
    console.error('Failed to update enrollment dates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
