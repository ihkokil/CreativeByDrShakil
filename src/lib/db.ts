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
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined in process.env. Ensure the environment variable is bound in Cloudflare.");
      }
      client = postgres(process.env.DATABASE_URL, { 
          prepare: false, 
          ssl: true,
          max: 2,
          idle_timeout: 10000,
          connect_timeout: 5,
      });
      _db = drizzle(client, { schema: schemaAndRelations });
    }
    return _db[prop];
  }
});
