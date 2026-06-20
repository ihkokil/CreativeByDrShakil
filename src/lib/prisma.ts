import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { checkEnvVariables } from './env-check';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType | undefined };

// ---------------------------------------------------------------------------
// Prisma Client Factory
// ---------------------------------------------------------------------------
// This project has TWO deployment targets:
//   1. Local development (Node.js) → standard @prisma/client with native engine
//   2. Production (Cloudflare Workers via OpenNext) → @prisma/client/wasm
//        + @prisma/adapter-neon for WebSocket-based database connections
//
// We use NODE_ENV to distinguish because production === Cloudflare Workers.
// The WASM client is required because Cloudflare Workers cannot load native
// Rust binaries. The Neon serverless adapter is required because standard
// pg.Pool uses TCP sockets that go stale when Workers isolates freeze.
// ---------------------------------------------------------------------------

let CachedPrismaClientClass: any = null;

function getPrismaClientClass() {
  if (CachedPrismaClientClass) {
    return CachedPrismaClientClass;
  }

  if (process.env.NODE_ENV === 'development') {
    // Local dev: use the standard @prisma/client with the native query engine.
    const { PrismaClient } = require('@prisma/client');
    CachedPrismaClientClass = PrismaClient;
  } else {
    // Production (Cloudflare Workers): use the WASM-based client.
    // We import from @prisma/client/wasm (which is in serverExternalPackages,
    // so webpack leaves it alone). At runtime it re-exports from
    // .prisma/client/wasm which loads the WASM query engine.
    const { PrismaClient } = require('@prisma/client/wasm');
    CachedPrismaClientClass = PrismaClient;
  }

  return CachedPrismaClientClass;
}

function getPrismaClient(): PrismaClientType {
  const PrismaClient = getPrismaClientClass();

  // During next build, create a dummy client (no DB connection needed).
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new PrismaClient({
      log: ['error'],
    }) as PrismaClientType;
  }

  // Run env checks lazily (process.env is only populated per-request in Workers).
  checkEnvVariables();

  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL environment variable is not defined.');
  }

  // Local development: let Prisma manage its own connection pool.
  // This prevents connection pool leaks during Turbopack/Webpack hot reloads.
  if (process.env.NODE_ENV === 'development') {
    return new PrismaClient({
      log: ['error', 'warn'],
    }) as PrismaClientType;
  }

  // Production (Cloudflare Workers): use the Neon serverless driver.
  // This communicates with Neon over WebSockets (native to Workers) instead
  // of TCP sockets (which go stale when isolates freeze between requests).
  const { Pool } = require('@neondatabase/serverless');
  const { PrismaNeon } = require('@prisma/adapter-neon');

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: ['error'],
  }) as PrismaClientType;
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

// Cache the instance on globalThis to reuse across warm starts.
// In dev, this prevents "too many connections" from HMR.
// In Workers, this reuses the client across requests in the same isolate.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
