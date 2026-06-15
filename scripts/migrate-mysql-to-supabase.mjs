import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mysqlUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!mysqlUrl || !mysqlUrl.startsWith('mysql://')) {
  console.error('Error: DATABASE_URL must be a valid mysql:// connection string.');
  process.exit(1);
}

if (!supabaseUrl || (!supabaseUrl.startsWith('postgresql://') && !supabaseUrl.startsWith('postgres://'))) {
  console.error('Error: SUPABASE_DATABASE_URL must be a valid postgresql:// connection string.');
  process.exit(1);
}

console.log('Connecting to databases...');
console.log('Source (MySQL):', mysqlUrl.split('@')[1] || mysqlUrl);
console.log('Target (Supabase):', supabaseUrl.split('@')[1] || supabaseUrl);

const prisma = new PrismaClient();
let mysqlConn;

// Order of deletion (child-to-parent to avoid constraint violations)
const tablesToDelete = [
  'Payment',
  'Order',
  'LessonProgress',
  'StudentModuleAvailability',
  'CourseInstructor',
  'Course',
  'Category',
  'ContactSubmission',
  'DeviceSession',
  'SessionLockSettings',
  'GlobalSessionLockSettings',
  'PaymentConfig',
  'EmailOtp',
  'VideoLibraryNode',
  'User',
  'Account',
  'Session',
  'VerificationToken'
];

// Order of migration (parent-to-child)
const tablesToMigrate = [
  { name: 'User', model: 'user' },
  { name: 'Category', model: 'category' },
  { name: 'Course', model: 'course' },
  { name: 'CourseInstructor', model: 'courseInstructor' },
  { name: 'LessonProgress', model: 'lessonProgress' },
  { name: 'StudentModuleAvailability', model: 'studentModuleAvailability' },
  { name: 'Order', model: 'order' },
  { name: 'Payment', model: 'payment' },
  { name: 'ContactSubmission', model: 'contactSubmission' },
  { name: 'DeviceSession', model: 'deviceSession' },
  { name: 'SessionLockSettings', model: 'sessionLockSettings' },
  { name: 'GlobalSessionLockSettings', model: 'globalSessionLockSettings' },
  { name: 'PaymentConfig', model: 'paymentConfig' },
  { name: 'EmailOtp', model: 'emailOtp' }
];

function mapRow(row, tableName) {
  const mapped = { ...row };

  // Boolean fields mapping (MySQL TINYINT(1) -> JS Boolean)
  const booleanFields = {
    User: ['emailVerified', 'canManagePayments'],
    Course: ['isFeatured'],
    DeviceSession: ['isLocked'],
    SessionLockSettings: ['autoLockFirstBrowser'],
    GlobalSessionLockSettings: ['autoLockFirstBrowser'],
    EmailOtp: ['verified']
  };

  if (booleanFields[tableName]) {
    for (const field of booleanFields[tableName]) {
      if (mapped[field] !== undefined && mapped[field] !== null) {
        mapped[field] = mapped[field] === 1 || mapped[field] === true || mapped[field] === '1';
      }
    }
  }

  // Date fields mapping
  for (const key of Object.keys(mapped)) {
    if (
      key.endsWith('At') ||
      key.endsWith('Expires') ||
      key === 'courseStartDate' ||
      key === 'expires' ||
      key === 'approvedAt' ||
      key === 'submittedAt' ||
      key === 'loggedOutAt' ||
      key === 'lastActivityAt'
    ) {
      if (mapped[key] !== undefined && mapped[key] !== null) {
        mapped[key] = new Date(mapped[key]);
      }
    }
  }

  return mapped;
}

async function main() {
  try {
    mysqlConn = await mysql.createConnection(mysqlUrl);
    console.log('Successfully connected to MySQL database.');

    // Step 1: Clear Supabase database tables to prevent duplicate key/foreign key violations
    console.log('\nClearing existing target data on Supabase...');
    for (const tableName of tablesToDelete) {
      const modelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
      try {
        if (prisma[modelName]) {
          await prisma[modelName].deleteMany();
          console.log(`- Cleared table: ${tableName}`);
        }
      } catch (err) {
        console.warn(`- Note: Could not clear table ${tableName} (it may not exist yet or has no mapping).`);
      }
    }

    // Step 2: Migrate standard tables
    console.log('\nMigrating tables from MySQL to Supabase...');
    for (const table of tablesToMigrate) {
      console.log(`\nMigrating ${table.name}...`);
      
      // Fetch data from MySQL
      let rows;
      try {
        const [result] = await mysqlConn.query(`SELECT * FROM \`${table.name}\``);
        rows = result;
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.log(`- Table ${table.name} does not exist in MySQL database. Skipping.`);
          continue;
        }
        throw err;
      }
      
      console.log(`- Found ${rows.length} rows in MySQL.`);
      
      if (rows.length === 0) {
        console.log(`- Skipping ${table.name} (no data)`);
        continue;
      }

      // Map rows (handles boolean & date conversions)
      const mappedRows = rows.map(row => mapRow(row, table.name));

      // Batch insert into Supabase using Prisma
      const batchSize = 100;
      for (let i = 0; i < mappedRows.length; i += batchSize) {
        const batch = mappedRows.slice(i, i + batchSize);
        await prisma[table.name.charAt(0).toLowerCase() + table.name.slice(1)].createMany({
          data: batch
        });
      }
      console.log(`- Successfully inserted ${rows.length} rows into Supabase.`);
    }

    // Step 3: Migrate self-referential VideoLibraryNode table
    console.log('\nMigrating VideoLibraryNode (Self-referential hierarchy)...');
    let nodeRows = [];
    try {
      const [result] = await mysqlConn.query('SELECT * FROM `VideoLibraryNode`');
      nodeRows = result;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log('- Table VideoLibraryNode does not exist in MySQL database. Skipping.');
      } else {
        throw err;
      }
    }
    
    console.log(`- Found ${nodeRows.length} nodes in MySQL.`);

    if (nodeRows.length > 0) {
      // Pass 1: Insert all nodes with parentId set to null to satisfy initial foreign key constraints
      console.log('- Pass 1: Inserting all nodes with parentId = null...');
      const mappedNodesNullParents = nodeRows.map(row => {
        const mapped = mapRow(row, 'VideoLibraryNode');
        mapped.parentId = null; // temporary
        return mapped;
      });

      const batchSize = 100;
      for (let i = 0; i < mappedNodesNullParents.length; i += batchSize) {
        const batch = mappedNodesNullParents.slice(i, i + batchSize);
        await prisma.videoLibraryNode.createMany({
          data: batch
        });
      }

      // Pass 2: Update nodes with their actual parentId values
      console.log('- Pass 2: Restoring parent-child relationships...');
      let updateCount = 0;
      for (const row of nodeRows) {
        if (row.parentId) {
          await prisma.videoLibraryNode.update({
            where: { id: row.id },
            data: { parentId: row.parentId }
          });
          updateCount++;
        }
      }
      console.log(`- Restored parent relationships for ${updateCount} nodes.`);
      console.log(`- Successfully migrated ${nodeRows.length} nodes in total.`);
    }

    console.log('\n=============================================');
    console.log('Database Migration Completed Successfully!');
    console.log('=============================================');

  } catch (error) {
    console.error('\nFatal Error during migration:', error);
  } finally {
    if (mysqlConn) {
      await mysqlConn.end();
    }
    await prisma.$disconnect();
  }
}

main();
