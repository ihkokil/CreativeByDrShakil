import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { checkEnvVariables } from './env-check';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType | undefined };

// We dynamically load the correct PrismaClient class depending on the environment.
// In production (Cloudflare Workers), we load the WASM client ('@prisma/client/wasm')
// to avoid filesystem scanning checks (fs.readdir) that throw in the edge environment.
let CachedPrismaClientClass: any = null;

// Check if we are running in a Cloudflare Workers / Edge environment.
// We check for Cloudflare Workers-specific globals (like WebSocketPair or navigator.userAgent)
// or the Next.js edge runtime environment variable.
const isEdgeOrCloudflare =
  typeof (globalThis as any).WebSocketPair !== 'undefined' ||
  (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
  process.env.NEXT_RUNTIME === 'edge';

function getPrismaClientClass() {
  if (CachedPrismaClientClass) {
    return CachedPrismaClientClass;
  }

  if (isEdgeOrCloudflare) {
    const { PrismaClient } = require('@prisma/client/wasm');
    CachedPrismaClientClass = PrismaClient;
  } else {
    const { PrismaClient } = require('@prisma/client');
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
  // Always use standard NEON_DATABASE_URL for Neon / production environments
  checkEnvVariables();

  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL environment variable is not defined.');
  }

  // In local development, bypass the pg adapter to let Prisma manage its own connection pool.
  // This prevents connection pool leaks during Turbopack hot reloads.
  if (process.env.NODE_ENV === 'development') {
    return new PrismaClient({
      log: ['error', 'warn'],
    }) as PrismaClientType;
  }

  // Cloudflare Workers / Edge environment: use Neon serverless driver over WebSockets
  if (isEdgeOrCloudflare) {
    const { Pool } = require('@neondatabase/serverless');
    const { PrismaNeon } = require('@prisma/adapter-neon');

    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);

    return new PrismaClient({
      adapter,
      log: ['error'],
    }) as PrismaClientType;
  }

  // Standard Node.js production environment (e.g. Vercel Serverless / Hostinger):
  // Let Prisma use its native Rust/binary query engine (more performant on Node.js)
  return new PrismaClient({
    log: ['error'],
  }) as PrismaClientType;
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production' || isEdgeOrCloudflare) {
  globalForPrisma.prisma = prisma;
}

export default prisma;

