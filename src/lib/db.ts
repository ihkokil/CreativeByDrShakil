import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | undefined;
let _pool: Pool | undefined;
let lastQueryTime = Date.now();

function createPool(connectionString: string) {
  const pool = new Pool({ 
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 10000, 
    allowExitOnIdle: true
  });
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
  return pool;
}

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
      
      _pool = createPool(connectionString);
      
      // We wrap the pool in a Proxy to seamlessly swap it out if the worker suspends.
      // This completely avoids the massive CPU cost of recreating PrismaClient (which easily breaks the 10ms Free Tier limit)
      // while guaranteeing that dead TCP sockets from frozen isolates are safely discarded.
      const poolProxy = new Proxy({} as Pool, {
        get(poolTarget, poolProp) {
          const now = Date.now();
          if (_pool && (now - lastQueryTime > 15000)) {
            const oldPool = _pool;
            _pool = createPool(connectionString);
            oldPool.end().catch(() => {});
          }
          lastQueryTime = now;
          
          const value = (_pool as any)[poolProp];
          if (typeof value === 'function') {
            return value.bind(_pool);
          }
          return value;
        }
      });
      
      const adapter = new PrismaPg(poolProxy);
      _prisma = new PrismaClient({ adapter });
    }
    
    return (_prisma as any)[prop];
  }
});

export default db;
