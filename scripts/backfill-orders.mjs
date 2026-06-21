import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting backfill for existing approved orders...');

  // Fetch all approved orders where enrolledAt or expiresAt is null
  const orders = await prisma.order.findMany({
    where: {
      status: 'approved',
      OR: [
        { enrolledAt: null },
        { expiresAt: null }
      ]
    }
  });

  console.log(`Found ${orders.length} orders requiring backfill.`);

  let updatedCount = 0;
  for (const order of orders) {
    const enrolledAt = order.enrolledAt || order.updatedAt || order.createdAt || new Date();
    // Expiry date is exactly 1 year (365 days) later
    const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        enrolledAt,
        expiresAt
      }
    });
    updatedCount++;
  }

  console.log(`✅ Successfully backfilled ${updatedCount} orders.`);
}

main()
  .catch((e) => {
    console.error('❌ Error running backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
