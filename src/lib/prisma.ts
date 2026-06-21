import { cache } from 'react';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { checkEnvVariables } from './env-check';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType | undefined };

// ---------------------------------------------------------------------------
// Prisma Client Factory
// ---------------------------------------------------------------------------
// This project now supports three environments:
//   1. Local development (Node.js) → standard @prisma/client
//   2. Vercel / Standard Node.js Production → standard @prisma/client with native engine
//   3. Cloudflare Workers (via OpenNext) → @prisma/client/wasm + WebSocket adapter
// ---------------------------------------------------------------------------

let CachedPrismaClientClass: any = null;

// Helper to check if we are running inside Cloudflare Workers
const checkIsCloudflare = () => {
  return (
    (typeof globalThis !== 'undefined' && 'WebSocketPair' in globalThis) ||
    process.env.CF_PAGES === '1' ||
    process.env.IS_CLOUDFLARE === 'true'
  );
};

function getPrismaClientClass() {
  if (CachedPrismaClientClass) {
    return CachedPrismaClientClass;
  }

  const isCloudflare = checkIsCloudflare();

  if (process.env.NODE_ENV === 'development' || !isCloudflare) {
    // Local dev or Vercel: use standard @prisma/client
    const { PrismaClient } = require('@prisma/client');
    CachedPrismaClientClass = PrismaClient;
  } else {
    // Cloudflare Workers: use WASM client
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

  checkEnvVariables();

  const connectionString = process.env.NEON_DATABASE_URL;
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

  const isCloudflare = checkIsCloudflare();

  // Local development or Vercel: standard TCP client connection pool
  if (process.env.NODE_ENV === 'development' || !isCloudflare) {
    return new PrismaClient({
      log: ['error', 'warn'],
    }) as PrismaClientType;
  }

  // Cloudflare Workers: use Neon WebSocket serverless driver
  const { PrismaNeon } = require('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: ['error'],
  }) as PrismaClientType;
}

const getRequestScopedPrismaClient = cache(() => {
  return getPrismaClient();
});

function getPrismaInstance(): PrismaClientType {
  const isCloudflare = checkIsCloudflare();

  // For Local & Vercel: Cache on globalThis to prevent connection leaks during HMR / serverless warm starts
  if (process.env.NODE_ENV === 'development' || !isCloudflare) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = getPrismaClient();
    }
    return globalForPrisma.prisma;
  }

  // For Cloudflare Workers: Cache request-scoped
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
