# Database Routing Architecture

This document outlines the strict routing rules for Supabase interactions in the Cloudflare Workers environment.

## 1. Database Topology
We operate a Primary-Replica cluster consisting of **6 total databases**:
- **1 Backup DB** (`SUPABASE_URL`) – Master node, source of truth.
- **5 Replicas** (`SUPABASE_URL_1` through `SUPABASE_URL_5`) – Read-only mirrors syncing every 15 minutes.

## 2. The Three Clients (`src/lib/db.ts`)

All database interactions MUST go through these three exported clients. Direct `createClient` usage is strictly forbidden.

### A. `getSupabaseAdmin()`
- **Purpose**: All writes, all auth, and all reads of user-specific data (Category A).
- **Target**: ALWAYS points to the Backup DB (`SUPABASE_URL`).
- **Permissions**: Bypasses RLS (uses `SERVICE_ROLE_KEY`). Security is enforced via Next.js middleware and route handlers.

### B. `getSupabaseContentRead()`
- **Purpose**: High-volume, public-facing reads of content (Category B).
- **Target**: Rotates across the 5 replicas daily (based on GMT+6 timezone).
- **Permissions**: Uses `ANON_KEY`.
- **FORBIDDEN FOR**: 
  - Any writes (`.insert()`, `.update()`, `.delete()`, `.upsert()`, `.rpc()`).
  - Any tables containing user data or PII (e.g., `User`, `DeviceSession`, `Order`, `Payment`).

### C. `getSupabase()`
- **Status**: DEPRECATED.
- **Purpose**: Kept only for reference. It was previously used when RLS was enabled, passing the user's JWT. 
- **Migration**: Replace all instances with `getSupabaseAdmin()` or `getSupabaseContentRead()` depending on the context.

## 3. Enforcement
A custom linter script (`scripts/check-db-usage.js`) enforces these rules. It can be run via:
```bash
npm run check:db
```
It fails the build if `getSupabaseContentRead` is used on forbidden tables or with write operations, and warns on deprecated `getSupabase` usage.
