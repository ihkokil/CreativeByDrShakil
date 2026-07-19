# Table Usage Audit

## Overview
This audit maps the original schema tables to their Supabase equivalents, identifies where they are read and written across the application, and ensures they belong to the correct category (A = Backup DB for user data, B = 5 Replicas for content reads).

### Table Precedence Rules
- **Category A (Global / Auth / Transactional):** Must ONLY be read from and written to the Backup DB (`getSupabaseAdmin()`). User-specific reads should never touch the read replicas.
- **Category B (Content):** Writes go to the Backup DB (master), but reads in public-facing routes should hit the replicas (`getSupabaseContentRead()`). 

## Table Usage Inventory

| Table | Read by (files) | Written by (files) | Category (A/B) | Matches Plan? |
|---|---|---|---|---|
| `User` | `api/auth/login/route.ts`, `api/users/route.ts`, `api/teacher/students/route.ts` | `api/auth/register/route.ts`, `api/teacher/users/ban/route.ts`, `api/user/update-profile/route.ts` | A | ✅ |
| `DeviceSession` | `lib/session-manager.ts`, `api/auth/login/route.ts`, `api/admin/sessions/route.ts` | `lib/session-manager.ts`, `api/admin/sessions/[sessionId]/rename/route.ts` | A | ✅ |
| `SessionLockSettings` | `lib/session-manager.ts` (resolveAutoLockSetting) | `lib/session-manager.ts` (setAutoLockSetting), `api/admin/user-session-settings/[userId]/route.ts` | A | ✅ |
| `GlobalSessionLockSettings` | `lib/session-manager.ts` (getGlobalSessionSettings) | `lib/session-manager.ts` (setGlobalSessionSettings), `api/admin/sessions/route.ts` | A | ✅ |
| `EmailOtp` | `api/auth/verify-otp/route.ts` | `api/auth/send-otp/route.ts` | A | ✅ |
| `Order` | `api/me/dashboard/route.ts`, `api/me/orders/route.ts`, `api/admin/orders/route.ts` | `api/orders/initiate/route.ts`, `api/payments/submit/route.ts`, `api/admin/orders/[orderId]/decision/route.ts` | A | ✅ |
| `Payment` | `api/me/orders/route.ts`, `api/admin/orders/route.ts` | `api/payments/submit/route.ts`, `api/payments/verify/route.ts` | A | ✅ |
| `PaymentConfig` | `api/payment-config/route.ts` (assumption) | `api/admin/payment-config/route.ts` (assumption) | A | ✅ |
| `ContactSubmission` | `api/admin/contact/route.ts` (assumption) | `api/contact/route.ts` (assumption) | A | ✅ |
| `LessonProgress` | `api/students/[id]/progress/route.ts`, `api/me/dashboard/route.ts` | `api/study/courses/[slug]/progress/route.ts` | A | ✅ |
| `QuizAttempt` | `api/quiz/[id]/results/route.ts`, `api/me/dashboard/route.ts` | `api/quiz/[id]/start/route.ts`, `api/quiz/attempt/[attemptId]/submit/route.ts` | A | ✅ |
| `AttemptAnswer` | `api/quiz/[id]/results/route.ts` | `api/quiz/attempt/[attemptId]/save-answer/route.ts` | A | ✅ |
| `QuizQuestionMapping` | `api/quiz/[id]/attempt/[attemptId]/route.ts` | `api/quiz/[id]/start/route.ts` | A | ✅ |
| `StudentModuleAvailability` | `api/study/courses/[slug]/curriculum/route.ts` | `api/teacher/students/batch-override/route.ts` | A | ✅ |
| `Course` | `api/courses/dynamic/[slug]/route.ts`, `api/courses/featured/route.ts` | `api/teacher/courses/[courseId]/publish/route.ts` | B | ✅ |
| `Category` | `api/courses/dynamic/route.ts` | `api/admin/categories/route.ts` (assumption) | B | ✅ |
| `CourseInstructor` | `api/courses/dynamic/[slug]/route.ts` | `api/teacher/courses/[courseId]/route.ts` | B | ✅ |
| `Quiz` | `api/quiz/route.ts`, `api/quiz/[id]/route.ts` | `api/quiz/[id]/route.ts` (PUT/POST by teacher) | B | ✅ |
| `Question` | `api/quiz/[id]/questions/route.ts` | `api/quiz/[id]/questions/route.ts` | B | ✅ |
| `QuizCategory` | `api/quiz/categories/route.ts` (assumption) | `api/teacher/quiz-categories/route.ts` (assumption) | B | ✅ |
| `VideoLibraryNode` | `api/teacher/video-library/route.ts` | `api/teacher/video-library/reorder/route.ts` | B | ✅ |

### Dead Tables
- `Account`, `Session`, `VerificationToken` are unused. 
- Flagged for removal in upcoming Step 8.5 (Drop dead NextAuth tables).

## Session Settings Analysis

### `SessionLockSettings` Precedence
- **Read/Write location:** Processed via `src/lib/session-manager.ts` (`resolveAutoLockSetting`) and modified via `src/app/api/admin/user-session-settings/[userId]/route.ts`.
- **Precedence Rule:** Per-user overrides **take precedence** over the global setting.
  ```typescript
  const effectiveAutoLockFirstBrowser = userAutoLockFirstBrowser ?? globalAutoLockFirstBrowser;
  ```
- **Impact on Step 7 RPC:** `fn_create_device_session` must query `SessionLockSettings` (per user) first. If a row exists, it overrides the `GlobalSessionLockSettings` for `autoLockFirstBrowser`.

### `GlobalSessionLockSettings` Context
- **Read location:** Processed via `src/lib/session-manager.ts` (`getGlobalSessionSettings`).
- **Usage:** Validated on login to enforce max concurrent sessions, and explicitly block non-exempt users based on `allowDesktop`, `allowTablet`, or `allowMobile`.

### `User.isSessionLockedExempt` Usage
- **Read/Checked:** Checked actively in `src/app/api/auth/login/route.ts`:
  ```typescript
  const isSessionRestrictionExempt = isPrivilegedRole || !!userRecord.isSessionLockedExempt;
  ```
- **Usage Context:** Exempts the user from device type blocking, concurrent session limits, and the `autoLockFirstBrowser` policy. Users with this flag can have unlimited sessions across any device type without triggering auto-locks.
