# Auth Model Deep Audit

**1. Is NextAuth still installed and actively used?**
- `package.json`: No `next-auth` in dependencies or devDependencies.
- Grep: No imports found in the codebase.
- Tables `Account`, `Session`, `VerificationToken` are not written to anywhere in `src/app/api/`. These are dead and can be safely flagged for removal.

**2. How is `deviceHash` generated?**
- Client-side generation (via Web Crypto API `crypto.subtle.digest('SHA-256')` with a custom fallback string hash based on hardware concurrency, platform, timezone, etc.) in `src/lib/client-fingerprint.ts` (lines 20-56).
- Passed to the server via the `x-device-hash` HTTP header.
- Server-side fallback (`src/app/api/auth/login/route.ts`:111-112) is a Base64-encoded string of `userAgent + osInfo + baseDeviceLabel`.

**3. How is `deviceType` detected?**
- Passed by the client via the `x-device-category` HTTP header.
- If missing, there is server-side fallback logic using regex in `src/lib/device-detection.ts` (`parseUserAgent`, line 11) or `src/lib/client-fingerprint.ts` (`getDeviceCategory`, line 68).

**4. Show the current login flow end-to-end:**
Implemented in `src/app/api/auth/login/route.ts`:
- **Verify Credentials:** Check password against `User.passwordHash`.
- **`User.isBanned` check:** Rejected with 403 (line 47).
- **GlobalSessionLockSettings enforcement:** Blocks login if device type is not allowed for students (lines 122-132).
- **Existing session lock logic:**
  - Clears existing active session on the *same device* (lines 154-161).
  - Enforces `autoLockFirstBrowser` (checks if a different device of the same category is already locked in, lines 164-177).
  - Enforces `maxConcurrentSessions` (locks the oldest sessions if limit exceeded via `lockSession()`, lines 180-189).
- **DeviceSession creation:** Inserts a new row with `isLocked: false` via `createDeviceSession()` (line 192).
- **JWT sign:** Creates a new token containing user details and `sessionId` via `signAuthToken()` (line 208).
- **Cookie set:** `AUTH_COOKIE_NAME` set with the new token.

**5. Show the logout flow:**
- In `src/app/api/auth/logout/route.ts` (lines 7-19), the server calls `terminateSession(sessionId)` from `src/lib/session-manager.ts`.
- `terminateSession` (lines 278-287) performs a soft-delete by setting `loggedOutAt: new Date().toISOString()`. The row is **not** deleted.

**6. Show the ban flow:**
- In `src/app/api/teacher/users/ban/route.ts` (lines 42-46), `User.isBanned = true` is set via an `.update({ isBanned: true })` call.
- **Cascade to `DeviceSession.isLocked`:** This is currently **NOT CASCADED** anywhere in the ban route. Sessions remain untouched in the database when a user is banned, relying on per-request validation to catch the ban.

**7. Show session validation on protected routes:**
- Currently implemented in `src/lib/auth-server.ts` via `getSession()` which calls `isSessionValid(sessionId)` from `src/lib/session-manager.ts` (lines 322-333).
- The exact query against `DeviceSession`:
  ```typescript
  const { data: session, error } = await supabase
    .from('DeviceSession')
    .select('isLocked, loggedOutAt')
    .eq('id', sessionId)
    .limit(1)
    .maybeSingle();

  return !session.isLocked && !session.loggedOutAt;
  ```

**8. Show `GlobalSessionLockSettings` usage:**
- Extracted via `getGlobalSessionSettings()` in `src/lib/session-manager.ts`.
- Evaluated during login in `src/app/api/auth/login/route.ts`:
  - `allowDesktop/Tablet/Mobile` are checked on lines 122-132. Students are blocked if the boolean for their `deviceType` is false.
  - `maxConcurrentSessions` is enforced on lines 180-189 by counting `activeSessions.length` and locking the oldest active sessions if the count exceeds the limit.

**9. What JWT payload structure is used?**
- In `src/lib/auth-server.ts` (`signAuthToken`, lines 30-38), `jose`'s `SignJWT` is used.
- Payload includes: `sub` (userId), `role`, `email`, `sessionId`, and `user_metadata` (containing `full_name`, `phone`, `bmdc_number`, `profile_image`, `canManagePayments`).
- It **does NOT** include `deviceHash`.

**10. Are there routes that bypass session validation?**
- Currently, since there is no Next.js `middleware.ts` enforcing authentication globally, any route that doesn't explicitly call `getSession()` bypasses validation.
- Notable examples include public endpoints like `/api/auth/login`, `/api/auth/register`, `/api/auth/google-callback`, `/api/auth/logout` (which reads token directly without validation failure), `/api/auth/reset-password`, etc.
