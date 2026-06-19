import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { checkEnvVariables } from './env-check';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getPrismaClient() {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new PrismaClient({
      log: ['error'],
    });
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
    });
  }

  // Use the connection pooler for pg.Pool in production
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

