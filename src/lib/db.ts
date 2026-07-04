import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const schemaAndRelations = { ...schema, ...relations };
type DbType = ReturnType<typeof drizzle<typeof schemaAndRelations>>;

let client: postgres.Sql;
let _db: DbType;

function getDatabaseUrl() {
  return process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
}

export const db = new Proxy({} as DbType, {
  get(target, prop: keyof typeof _db | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    if (!_db) {
      const databaseUrl = getDatabaseUrl();

      if (!databaseUrl) {
        throw new Error('SUPABASE_DATABASE_URL or DATABASE_URL is not defined in process.env. Ensure the database URL is bound in Cloudflare.');
      }

      client = postgres(databaseUrl, {
        prepare: false,
        ssl: process.env.NODE_ENV === 'production' ? true : 'require',
        max: 2,
        idle_timeout: 10000,
        connect_timeout: 30,
      });
      _db = drizzle(client, { schema: schemaAndRelations });
    }
    return _db[prop];
  }
});
