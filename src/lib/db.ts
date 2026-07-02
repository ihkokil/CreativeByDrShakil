import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema: { ...schema, ...relations } });
