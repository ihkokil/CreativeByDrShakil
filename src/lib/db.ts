import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const schemaAndRelations = { ...schema, ...relations };
type DbType = ReturnType<typeof drizzle<typeof schemaAndRelations>>;

let client: postgres.Sql;
let _db: DbType;

export const db = new Proxy({} as DbType, {
  get(target, prop: keyof typeof _db | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    if (!_db) {
      const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("No database URL is defined in process.env. Ensure the environment variable is bound in Cloudflare.");
      }
      client = postgres(dbUrl, { 
          prepare: false, 
          // Local Node.js rejects self-signed certs (needs 'require' to bypass)
          // Cloudflare Workers hangs if 'require' is passed due to unsupported TLS options
          ssl: process.env.NODE_ENV === 'production' ? true : 'require',
          max: 2,
          idle_timeout: 10000,
          connect_timeout: 30, // Increased to 30s to allow Cloudflare Worker cold starts to reach Tokyo
      });
      _db = drizzle(client, { schema: schemaAndRelations });
    }
    return _db[prop];
  }
});
