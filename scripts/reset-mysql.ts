import 'dotenv/config';
import mysql from 'mysql2/promise';

async function resetDb() {
  const connectionString = process.env.MYSQL_DIRECT_URL || process.env.MYSQL_DATABASE_URL;
  if (!connectionString) throw new Error('Missing MYSQL connection string');

  console.log('Connecting to drop all tables...');
  const conn = await mysql.createConnection({
    uri: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Disable foreign key checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Get all tables
    const [rows] = await conn.query('SHOW TABLES');
    const tables = (rows as any[]).map(row => Object.values(row)[0]);

    if (tables.length === 0) {
      console.log('No tables to drop.');
    } else {
      console.log(`Dropping ${tables.length} tables...`);
      for (const table of tables) {
        await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`Dropped ${table}`);
      }
    }

    // Re-enable foreign key checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database reset complete.');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

resetDb().catch(console.error);
