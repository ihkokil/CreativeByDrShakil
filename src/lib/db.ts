import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | undefined;
let _pool: Pool | undefined;
let lastQueryTime = Date.now();

export const db = new Proxy({} as PrismaClient, {
  get(target, prop: keyof PrismaClient | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    
    const now = Date.now();
    if (_prisma && (now - lastQueryTime > 15000)) {
      const oldPrisma = _prisma;
      const oldPool = _pool;
      _prisma = undefined;
      _pool = undefined;
      
      oldPrisma.$disconnect().catch(() => {});
      if (oldPool) {
        oldPool.end().catch(() => {});
      }
    }
    
    lastQueryTime = now;
    
    if (!_prisma) {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined in process.env. Ensure the environment variable is bound in Cloudflare.");
      }
      
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        query_timeout: 10000, // 10s timeout as a failsafe
        allowExitOnIdle: true
      });
      
      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
      
      _pool = pool;
      const adapter = new PrismaPg(pool);
      _prisma = new PrismaClient({ adapter });
    }
    
    return (_prisma as any)[prop];
  }
});

export default db;
