import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log('Connecting to database...');

  // The target date: 12 June, 2026
  const targetDate = new Date("2026-06-12T00:00:00.000Z").toISOString();

  console.log(`Setting student enrollment dates to: ${targetDate}`);

  // 1. Update the 'createdAt' property of all users with role 'student'
  const updatedUsers = await db.update(schema.user)
    .set({ createdAt: targetDate })
    .where(eq(schema.user.role, 'student'))
    .returning({ id: schema.user.id });

  console.log(`Updated ${updatedUsers.length} students' profiles (User.createdAt).`);

  if (updatedUsers.length > 0) {
    const studentIds = updatedUsers.map(u => u.id);
    
    // 2. Update the 'createdAt' property of all orders (which represents course enrollment)
    const updatedOrders = await db.update(schema.order)
      .set({ createdAt: targetDate, enrolledAt: targetDate })
      .where(inArray(schema.order.userId, studentIds))
      .returning({ id: schema.order.id });

    console.log(`Updated ${updatedOrders.length} course enrollments (Order.createdAt & enrolledAt).`);
  } else {
    console.log(`Updated 0 course enrollments.`);
  }

  console.log('Done!');
}

main()
  .catch((error) => {
    console.error('Failed to update enrollment dates:', error);
    process.exit(1);
  });
