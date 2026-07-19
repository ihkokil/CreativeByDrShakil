# CreativeByDrShakil — Complete Migration, Hardening & Cloudflare Workers Readiness Plan

## Preamble

You are working on a Next.js learning platform being migrated from Drizzle/MySQL to Supabase (HTTPS) and deployed to **Cloudflare Workers (free tier)**. This document is the **authoritative plan** and supersedes ALL previous plans and conversations.

---

## 🏛️ Confirmed Architectural Ground Truth

### Application
- **Framework:** Next.js
- **Deployment Target:** Cloudflare Workers (free tier) via `@opennextjs/cloudflare`
- **No TCP database drivers anywhere in the request path**
- **All DB access via `@supabase/supabase-js` over HTTPS**

### Database Topology
- **6 total Supabase databases:**
  - 5 replicas: `SUPABASE_URL_1` .. `SUPABASE_URL_5`
  - 1 backup / source of truth: `SUPABASE_URL`
- **Backup DB = source of truth for ALL writes and ALL user-specific data**
- **5 replicas = read-only mirrors of content tables** (for load balancing public content reads)

### Schema Categories
**Category A — Global / Auth / Transactional (Backup DB ONLY, never routed):**
- `User`
- `DeviceSession`, `SessionLockSettings`, `GlobalSessionLockSettings`
- `EmailOtp`
- `Order`, `Payment`, `PaymentConfig`
- `ContactSubmission`
- `LessonProgress`, `QuizAttempt`, `AttemptAnswer`, `QuizQuestionMapping`
- `StudentModuleAvailability`

**Category B — Content (Backup DB is master; 5 replicas mirror for reads):**
- `Course`, `Category`, `CourseInstructor`
- `Quiz`, `Question`, `QuizCategory`
- `VideoLibraryNode`

*(Note: `Account`, `Session`, `VerificationToken` are dead and will be dropped in Step 8.5)*

### Authentication Model
Custom auth, NOT Supabase Auth. Enterprise-grade session management:
- **JWT signing:** `jose` library with `JWT_SECRET`
- **Session store:** `DeviceSession` table (server-side, revocable)
- **Device fingerprinting:** Web Crypto SHA-256 passed via `x-device-hash` header. Base64 fallback if missing.
- **Session lock model:** Device swap = LOCK old session, CREATE new session.
- **Ban cascade:** Middleware must catch bans instantly. Ban RPC locks sessions.
- **Global / Per-User Limits:** Handled by `GlobalSessionLockSettings` and overridden by `SessionLockSettings` (`User.isSessionLockedExempt` bypasses all).

### Security Model
- **RLS is DISABLED** on all tables.
- **All authorization enforced in Next.js middleware + route handlers.**
- **99% of routes** use `getSupabaseAdmin()` (service role).
- **Every user-owned query** must be explicitly scoped.

---

## 📊 Progress Tracker

See `docs/migration-progress.md` for live tracking.

---

# STEP 0.A — Auth Model Deep Audit (READ-ONLY)
*(Completed)*

---

# STEP 0.B — Table Usage Audit (READ-ONLY)
*(Completed)*

---

# STEP 1 — Database Routing Rewrite
- Rewrite `src/lib/db.ts` to export: `getSupabaseContentRead`, `getSupabaseAdmin`, and `getSupabase` (deprecated).
- Add script `scripts/check-db-usage.js` to ensure Category A tables aren't queried using `getSupabaseContentRead`.

---

# STEP 2 — Disable RLS + Drop All Policies
- Migration script to drop policies and disable RLS across all 6 databases.

---

# STEP 3 — Environment Variable Cleanup
- Remove legacy MySQL/Drizzle and unused Supabase vars.
- Finalize Cloudflare secrets list.

---

# STEP 4 — Generate & Apply Supabase Types
- Use `npm run db:types` to generate types. Replace `any` typings with `SupabaseClient<Database>`.

---

# STEP 5 — Migration Inventory (Actual Numbers)
- Audit APIs for `MIGRATION_STUB` and old libraries. 

---

# STEP 6 — Authentication Middleware (Device-Session Aware)
- Create `src/middleware.ts` to block requests without valid sessions.
- **AMENDMENT 1:** Middleware MUST check `user.isBanned = false` on every request.
- **AMENDMENT 2:** Compare `x-device-hash` against `session.deviceHash`. Mismatches → 401. Do not add `deviceHash` to JWT.
- **AMENDMENT 3:** `isSessionValid` must check: row exists, `userId === jwt.sub`, `!isLocked`, `loggedOutAt IS NULL`, `deviceHash === x-device-hash`, `!user.isBanned`.
- **AMENDMENT 5:** Add `/api/auth/logout` to public allowlist, but with notes indicating it extracts sessionId and terminates it safely without full strict validation.

---

# STEP 7 — Device Session RPCs (Atomic Operations)
- Create RPC `fn_create_device_session`. Must check `SessionLockSettings` first for per-user overrides over `GlobalSessionLockSettings`.
- Create RPC `fn_logout_device_session`.
- **AMENDMENT 1:** `fn_ban_user` RPC is a CRITICAL SECURITY FIX to instantly lock all device sessions when a user is banned.

---

# STEP 8 — Missing Indexes
- Apply critical indexes for middleware lookups, orders, quizzes, and OTP cleanup.

---

# STEP 8.5 — Drop Dead NextAuth Tables
- **AMENDMENT 6:** Write a migration to drop `Account`, `Session`, `VerificationToken` tables. Regenerate types.

---

# STEP 9 — Content Sync Strategy
- Implement 15-minute cron sync script for Category B tables across the 5 replicas.

---

# STEP 10 — Data-Leak Surface Audit
- Create `db-helpers.ts` (`scopedToUser`, `scopedToStudent`, `publishedOnly`).
- Fix unscoped queries and enforce strict validation.

---

# STEP 11 — Cache Safety
- Enforce `dynamic = 'force-dynamic'` or `no-store` Cache-Control headers on user-specific APIs to prevent CDN cross-leaks.

---

# STEP 12 — Cloudflare Workers Preparation
- Replace Node APIs with Web Standard ones. 
- **AMENDMENT 4:** Verify `btoa`/`Uint8Array` fallbacks and Web Crypto usage in `client-fingerprint.ts` and `device-detection.ts` are 100% Cloudflare Workers-safe.
- Remove dead dependencies from `package.json`. Create `wrangler.toml` and test `build:worker`.

---

# STEP 13 — Load Test + Deploy
- Verify missing `drizzle-orm` dependencies. Run concurrent and ban load tests. Deploy to staging, verify, then roll to production.
