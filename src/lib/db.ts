import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '@/db/schema';

// Connection string from env
const connectionString = process.env.MYSQL_DATABASE_URL || process.env.MYSQL_DIRECT_URL;

if (!connectionString) {
  throw new Error("MYSQL_DATABASE_URL is not defined in process.env.");
}

// Global caching for the connection pool in development
// This prevents exhausting connections on hot reloads
const globalForDb = globalThis as unknown as {
  pool: mysql.Pool | undefined;
};

const pool = globalForDb.pool ?? mysql.createPool({
  uri: connectionString,
  connectionLimit: 5,
  maxIdle: 5, 
  idleTimeout: 30000, 
  enableKeepAlive: true,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema, mode: 'default' });
export default db;
