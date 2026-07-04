import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { cache } from 'react'

const getPrismaClient = cache(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in process.env. Ensure the environment variable is bound in Cloudflare.");
  }
  
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ 
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000 // Short idle timeout
  });
  
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
  
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
});

export const db = new Proxy({} as PrismaClient, {
  get(target, prop: keyof PrismaClient | symbol) {
    if ((prop as string) === 'then' || typeof prop === 'symbol') {
      return Reflect.get(target, prop);
    }
    
    // Always get a request-scoped client instead of a global one
    // This absolutely guarantees we never reuse a suspended/frozen TCP connection on Cloudflare Workers
    const client = getPrismaClient();
    return (client as any)[prop];
  }
});

export default db;
