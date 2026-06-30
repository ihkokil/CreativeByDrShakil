import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

// During Next.js static build, the environment variable might not be present.
// Fallback to a dummy URL to prevent `neon()` from throwing an initialization error.
const sql = neon(process.env.NEON_DATABASE_URL || 'postgresql://dummy:dummy@dummy.neon.tech/dummy');
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
