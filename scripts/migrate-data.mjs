import { PrismaClient as PrismaPostgres } from '@prisma/client';
import { createConnection } from 'mysql2/promise';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL (for MySQL) is missing in .env");
    process.exit(1);
  }
  if (!process.env.SUPABASE_DATABASE_URL) {
    console.error("❌ SUPABASE_DATABASE_URL (for Postgres) is missing in .env");
    process.exit(1);
  }

  console.log("Connecting to MySQL via mysql2 to fetch data...");
  const mysql = await createConnection(process.env.DATABASE_URL);

  const fetchTable = async (tableName) => {
    console.log(`Fetching ${tableName} from MySQL...`);
    const [rows] = await mysql.query(`SELECT * FROM \`${tableName}\``);
    return rows;
  };

  let users, categories, globalSettings, paymentConfigs, courses, sessionSettings, contactSubs, instructors, deviceSessions, orders, availabilities, progresses, payments, videoNodes;

  try {
    users = await fetchTable('User');
    categories = await fetchTable('Category');
    globalSettings = await fetchTable('GlobalSessionLockSettings');
    paymentConfigs = await fetchTable('PaymentConfig');
    courses = await fetchTable('Course');
    sessionSettings = await fetchTable('SessionLockSettings');
    contactSubs = await fetchTable('ContactSubmission');
    instructors = await fetchTable('CourseInstructor');
    deviceSessions = await fetchTable('DeviceSession');
    orders = await fetchTable('Order');
    availabilities = await fetchTable('StudentModuleAvailability');
    progresses = await fetchTable('LessonProgress');
    payments = await fetchTable('Payment');
    videoNodes = await fetchTable('VideoLibraryNode');

    console.log("All data successfully fetched from MySQL! Closing MySQL connection...");
    await mysql.end();
  } catch (err) {
    console.error("❌ Error fetching data from MySQL:", err);
    await mysql.end();
    process.exit(1);
  }

  console.log("Connecting to Postgres via Prisma...");
  const pg = new PrismaPostgres();

  try {
    // 1. Independent Tables
    console.log(`Migrating ${users.length} Users...`);
    for (const u of users) {
      if (u.emailVerificationExpires === '0000-00-00 00:00:00') u.emailVerificationExpires = null;
      if (u.passwordResetExpires === '0000-00-00 00:00:00') u.passwordResetExpires = null;
      u.emailVerified = u.emailVerified === 1;
      u.canManagePayments = u.canManagePayments === 1;
      await pg.user.upsert({ where: { id: u.id }, update: u, create: u });
    }

    console.log(`Migrating ${categories.length} Categories...`);
    for (const c of categories) {
      await pg.category.upsert({ where: { id: c.id }, update: c, create: c });
    }

    console.log(`Migrating ${globalSettings.length} GlobalSessionLockSettings...`);
    for (const g of globalSettings) {
      g.autoLockFirstBrowser = g.autoLockFirstBrowser === 1;
      await pg.globalSessionLockSettings.upsert({ where: { id: g.id }, update: g, create: g });
    }

    console.log(`Migrating ${paymentConfigs.length} PaymentConfig...`);
    for (const p of paymentConfigs) {
      await pg.paymentConfig.upsert({ where: { id: p.id }, update: p, create: p });
    }

    // 2. First-level dependencies
    console.log(`Migrating ${courses.length} Courses...`);
    for (const c of courses) {
      c.isFeatured = c.isFeatured === 1;
      if (c.courseStartDate === '0000-00-00 00:00:00') c.courseStartDate = null;
      if (c.releaseStartAt === '0000-00-00 00:00:00') c.releaseStartAt = null;
      if (c.publishedAt === '0000-00-00 00:00:00') c.publishedAt = null;
      await pg.course.upsert({ where: { id: c.id }, update: c, create: c });
    }

    console.log(`Migrating ${sessionSettings.length} SessionLockSettings...`);
    for (const s of sessionSettings) {
      s.autoLockFirstBrowser = s.autoLockFirstBrowser === 1;
      await pg.sessionLockSettings.upsert({ where: { id: s.id }, update: s, create: s });
    }

    console.log(`Migrating ${contactSubs.length} ContactSubmissions...`);
    for (const c of contactSubs) {
      if (c.adminReplySentAt === '0000-00-00 00:00:00') c.adminReplySentAt = null;
      await pg.contactSubmission.upsert({ where: { id: c.id }, update: c, create: c });
    }

    // 3. Second-level dependencies
    console.log(`Migrating ${instructors.length} CourseInstructors...`);
    for (const i of instructors) {
      await pg.courseInstructor.upsert({ where: { id: i.id }, update: i, create: i });
    }

    console.log(`Migrating ${deviceSessions.length} DeviceSessions...`);
    for (const d of deviceSessions) {
      d.isLocked = d.isLocked === 1;
      if (d.loggedOutAt === '0000-00-00 00:00:00') d.loggedOutAt = null;
      await pg.deviceSession.upsert({ where: { id: d.id }, update: d, create: d });
    }

    console.log(`Migrating ${orders.length} Orders...`);
    for (const o of orders) {
      await pg.order.upsert({ where: { id: o.id }, update: o, create: o });
    }

    console.log(`Migrating ${availabilities.length} StudentModuleAvailability...`);
    for (const a of availabilities) {
      if (a.availableAt === '0000-00-00 00:00:00') a.availableAt = null;
      await pg.studentModuleAvailability.upsert({ where: { id: a.id }, update: a, create: a });
    }

    console.log(`Migrating ${progresses.length} LessonProgress...`);
    for (const p of progresses) {
      await pg.lessonProgress.upsert({ where: { id: p.id }, update: p, create: p });
    }

    // 4. Third-level dependencies
    console.log(`Migrating ${payments.length} Payments...`);
    for (const p of payments) {
      if (p.approvedAt === '0000-00-00 00:00:00') p.approvedAt = null;
      await pg.payment.upsert({ where: { id: p.id }, update: p, create: p });
    }

    // VideoLibraryNode recursive migration
    console.log(`Migrating ${videoNodes.length} VideoLibraryNodes...`);
    let remaining = [...videoNodes];
    let processing = remaining.filter(n => !n.parentId);
    remaining = remaining.filter(n => n.parentId);

    while (processing.length > 0) {
      for (const v of processing) {
        await pg.videoLibraryNode.upsert({ where: { id: v.id }, update: v, create: v });
      }
      const newlyAddedIds = processing.map(p => p.id);
      processing = remaining.filter(n => newlyAddedIds.includes(n.parentId));
      remaining = remaining.filter(n => !newlyAddedIds.includes(n.parentId));
    }

    if (remaining.length > 0) {
      console.warn(`⚠️ WARNING: ${remaining.length} VideoLibraryNodes could not be inserted due to missing parent nodes.`);
    }

    console.log("✅ Data Migration Complete!");
  } catch (err) {
    console.error("❌ Migration Error:", err);
  } finally {
    await pg.$disconnect();
  }
}

main();
