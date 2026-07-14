import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const poolConnection = mysql.createPool({
  uri: process.env.MYSQL_DATABASE_URL!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(poolConnection, { schema: { ...schema, ...relations }, mode: 'default' });
