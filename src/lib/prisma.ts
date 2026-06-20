import { cache } from 'react';
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
  console.log('[Prisma Init] NEON_DATABASE_URL present:', !!connectionString, 'length:', connectionString?.length);
  if (connectionString) {
    // Log masked connection string for safety
    try {
      const url = new URL(connectionString);
      console.log('[Prisma Init] Host:', url.hostname, 'Protocol:', url.protocol, 'Database:', url.pathname);
    } catch (e) {
      console.log('[Prisma Init] Failed to parse connection string as URL');
    }
  }

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
  const { PrismaNeon } = require('@prisma/adapter-neon');

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: ['error'],
  }) as PrismaClientType;
}

// Helper to retrieve the actual client instance lazily.
// In development, cache on globalThis to prevent connection leaks from HMR.
// In production (Cloudflare Workers), cache on a request-scoped basis using React's cache()
// to prevent "Cannot perform I/O on behalf of a different request" error across isolates.
const getRequestScopedPrismaClient = cache(() => {
  return getPrismaClient();
});

function getPrismaInstance(): PrismaClientType {
  if (process.env.NODE_ENV === 'development') {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = getPrismaClient();
    }
    return globalForPrisma.prisma;
  }

  return getRequestScopedPrismaClient();
}

// Export a Proxy wrapper that delegates property access to the lazily initialized client.
// This prevents Prisma from evaluating environment variables (like NEON_DATABASE_URL) at module import time,
// which is crucial since Cloudflare Workers only populate process.env per-request.
export const prisma = new Proxy({} as PrismaClientType, {
  get(target, prop) {
    const instance = getPrismaInstance();
    const value = Reflect.get(instance, prop);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});

export default prisma;
