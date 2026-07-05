import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | undefined;
let lastQueryTime = Date.now();

export const db = new Proxy({} as PrismaClient, {
  get(target, prop: keyof PrismaClient | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    
    const now = Date.now();
    // In Cloudflare Workers, TCP sockets can be suspended and broken if the worker goes idle.
    // If it's been more than 15 seconds since the last query, the worker might have been suspended.
    // We proactively recreate the client and pool to avoid hanging on a dead TCP connection.
    if (_prisma && (now - lastQueryTime > 15000)) {
      const oldPrisma = _prisma;
      _prisma = undefined;
      // Fire and forget disconnect to clean up old connections gracefully
      oldPrisma.$disconnect().catch(() => {});
    }
    
    lastQueryTime = now;
    
    if (!_prisma) {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined in process.env. Ensure the environment variable is bound in Cloudflare.");
      }
      const connectionString = process.env.DATABASE_URL;
      
      const pool = new Pool({ 
        connectionString,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        query_timeout: 10000, // 10s timeout as a failsafe to prevent infinite hanging
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
