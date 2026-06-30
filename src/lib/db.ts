import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const sql = neon(process.env.NEON_DATABASE_URL || 'postgres://dummy:dummy@dummy/dummy');
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
