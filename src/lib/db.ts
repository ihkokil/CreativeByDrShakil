import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

// FREE TIER OPTIMIZATION: Conservative connection pool settings
// Cloudflare Workers Free Tier has 50ms CPU budget per request
// More connections = more CPU overhead, so we keep it minimal
const client = postgres(process.env.DATABASE_URL!, { 
    prepare: false, 
    ssl: 'require',
    max: 2,               // Only 2 concurrent connections for Free Tier
    idle_timeout: 10000,  // 10 seconds (was 0: infinite idle connections)
    connect_timeout: 5,   // Fail fast on Free Tier (was 10ms)
});
export const db = drizzle(client, { schema: { ...schema, ...relations } });
