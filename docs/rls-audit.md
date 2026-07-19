| Route | Role Needed | Reason |
|---|---|---|
| `/api/auth/login` | `getSupabaseAdmin()` | Reads password hash, bypasses RLS |
| `/api/auth/register` | `getSupabaseAdmin()` | Writes to User table |
| `/api/auth/forgot-password` | `getSupabaseAdmin()` | Writes reset token |
| `/api/auth/verify-otp` | `getSupabaseAdmin()` | Updates user emailVerified |
| `/api/auth/google-callback` | `getSupabaseAdmin()` | Upserts user, reads passwords |
| `/api/auth/reset-password` | `getSupabaseAdmin()` | Updates password hash |
| `/api/auth/send-otp` | `getSupabaseAdmin()` | Writes OTP hash |
| `/api/me/dashboard` | `getSupabase()` | User owns their data |
| `/api/me/orders` | `getSupabase()` | User owns their orders |
| `/api/courses/[slug]` | `getSupabase()` | Public reads for active courses |
| `/api/courses/route` | `getSupabase()` | Public reads |
| `/api/admin/*` | `getSupabaseAdmin()` | Admin operations |
| `/api/teacher/*` | `getSupabaseAdmin()` | Teacher management |
| `/api/payments/*` | `getSupabaseAdmin()` | Highly sensitive inserts and updates |
| `/api/telegram/webhook` | `getSupabaseAdmin()` | Server-to-server operations |
| `/api/quiz/*` | `getSupabaseAdmin()` | Reads/writes quiz data. Depending on route, RLS could be used, but keeping it Admin is safer during migration |
| `/api/study/*` | `getSupabaseAdmin()` | Updates lesson progress and retrieves private curriculum. |

*Note: This is a high-level audit for Phase 0. Specific routes like quiz or study may be downgraded to `getSupabase()` in their respective phases once robust RLS policies are applied to `LessonProgress` and `QuizAttempt`.*
