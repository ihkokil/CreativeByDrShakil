import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { checkEnvVariables } from './env-check';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType | undefined };

// We dynamically load the correct PrismaClient class depending on the environment.
// In production (Cloudflare Workers), we load the WASM client ('@prisma/client/wasm')
// to avoid filesystem scanning checks (fs.readdir) that throw in the edge environment.
let CachedPrismaClientClass: any = null;

function getPrismaClientClass() {
  if (CachedPrismaClientClass) {
    return CachedPrismaClientClass;
  }

  if (process.env.NODE_ENV === 'development') {
    const { PrismaClient } = require('@prisma/client');
    CachedPrismaClientClass = PrismaClient;
  } else {
    const { PrismaClient } = require('@prisma/client/wasm');
    CachedPrismaClientClass = PrismaClient;
  }

  return CachedPrismaClientClass;
}

function getPrismaClient(): PrismaClientType {
  const PrismaClient = getPrismaClientClass();

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new PrismaClient({
      log: ['error'],
    }) as PrismaClientType;
  }

  // Run env checks lazily (process.env is only populated per-request in Workers)
  checkEnvVariables();

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DATABASE_URL environment variable is not defined.');
  }

  // In local development, bypass the pg adapter to let Prisma manage its own connection pool.
  // This prevents connection pool leaks during Turbopack hot reloads.
  if (process.env.NODE_ENV === 'development') {
    return new PrismaClient({
      log: ['error', 'warn'],
    }) as PrismaClientType;
  }

  // Use the connection pooler for pg.Pool in production
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ['error'],
  }) as PrismaClientType;
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

