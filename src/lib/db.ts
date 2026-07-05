import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | undefined;

export const db = new Proxy({} as PrismaClient, {
  get(target, prop: keyof PrismaClient | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    
    if (!_prisma) {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined in process.env. Ensure the environment variable is bound in Cloudflare.");
      }
      const connectionString = process.env.DATABASE_URL;
      
      const pool = new Pool({ 
        connectionString,
        max: 5,
        connectionTimeoutMillis: 5000,
        // 500ms idle timeout allows connection reuse WITHIN a single request (avoiding per-query handshake CPU overhead),
        // but ensures sockets close before Cloudflare suspends the worker (avoiding TCP socket hangs).
        // This keeps execution well within the Free Tier 10ms CPU limit since PrismaClient is only initialized once.
        idleTimeoutMillis: 500,
        query_timeout: 10000, 
        allowExitOnIdle: true
      });
      
      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
      
      const adapter = new PrismaPg(pool);
      _prisma = new PrismaClient({ adapter });
    }
    
    return (_prisma as any)[prop];
  }
});

export default db;
