import mysql from 'mysql2/promise';

const mysqlUrl = process.argv[2];

if (!mysqlUrl || !mysqlUrl.startsWith('mysql://')) {
  console.error('Error: Please provide a valid mysql:// connection string as the first argument.');
  console.error('Usage: node scripts/remove-mysql-predefined-courses.mjs "mysql://user:pass@host:port/db"');
  process.exit(1);
}

const CLINICAL_COURSE_SLUGS = [
  'medicine-and-allied',
  'surgery-and-allied',
  'gynae-and-obsetrics',
  'radiology',
  'dermatology',
  'basics'
];

const CLINICAL_COURSE_TITLES = [
  'Medicine and Allied',
  'Surgery and Allied',
  'Gynae& Obstetrics',
  'Radiology',
  'Dermatology',
  'Basics'
];

async function main() {
  console.log('Connecting to MySQL database...');
  const conn = await mysql.createConnection(mysqlUrl);
  console.log('Successfully connected to MySQL database.');

  try {
    // 1. Fetch matching courses
    const [courses] = await conn.query(
      'SELECT id, title, slug FROM Course WHERE slug IN (?) OR title IN (?)',
      [CLINICAL_COURSE_SLUGS, CLINICAL_COURSE_TITLES]
    );

    if (courses.length === 0) {
      console.log('No matching predefined courses found in this database.');
      return;
    }

    const courseIds = courses.map(c => c.id);
    console.log(`Found ${courses.length} courses to delete:`);
    courses.forEach(c => console.log(` - ${c.title} (${c.slug}) [ID: ${c.id}]`));

    console.log('\nExecuting deletion...');

    // 2. Fetch associated Order IDs
    const [orders] = await conn.query(
      'SELECT id FROM `Order` WHERE courseId IN (?)',
      [courseIds]
    );
    const orderIds = orders.map(o => o.id);

    // 3. Delete payments first to respect foreign key constraints
    if (orderIds.length > 0) {
      const [delPayments] = await conn.query(
        'DELETE FROM Payment WHERE orderId IN (?)',
        [orderIds]
      );
      console.log(`Deleted ${delPayments.affectedRows} Payment records.`);
    } else {
      console.log('No associated orders/payments to delete.');
    }

    // 4. Delete orders
    const [delOrders] = await conn.query(
      'DELETE FROM `Order` WHERE courseId IN (?)',
      [courseIds]
    );
    console.log(`Deleted ${delOrders.affectedRows} Order records.`);

    // 5. Delete LessonProgress
    const [delProgress] = await conn.query(
      'DELETE FROM LessonProgress WHERE courseId IN (?)',
      [courseIds]
    );
    console.log(`Deleted ${delProgress.affectedRows} LessonProgress records.`);

    // 6. Delete StudentModuleAvailability
    const [delAvailability] = await conn.query(
      'DELETE FROM StudentModuleAvailability WHERE courseId IN (?)',
      [courseIds]
    );
    console.log(`Deleted ${delAvailability.affectedRows} StudentModuleAvailability records.`);

    // 7. Delete CourseInstructors
    const [delInstructors] = await conn.query(
      'DELETE FROM CourseInstructor WHERE courseId IN (?)',
      [courseIds]
    );
    console.log(`Deleted ${delInstructors.affectedRows} CourseInstructor records.`);

    // 8. Delete Courses
    const [delCourses] = await conn.query(
      'DELETE FROM Course WHERE id IN (?)',
      [courseIds]
    );
    console.log(`Deleted ${delCourses.affectedRows} Course records.`);

    console.log('\nMySQL database cleanup complete!');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('An error occurred during cleanup:', err);
  process.exit(1);
});
