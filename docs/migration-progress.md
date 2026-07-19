# Migration Progress

| Step | Description | Status | Approved | Notes |
|---|---|---|---|---|
| 0.A | Auth model deep audit | ✅ | Yes | Amendments 1-7 incorporated |
| 0.B | Table usage audit | ✅ | Yes | |
| 1 | DB routing rewrite | ✅ | Yes | |
| 2 | Disable RLS + drop policies | ✅ | Yes | |
| 3 | Env var cleanup | ✅ | Yes | |
| 4 | Generate & apply Supabase types | ✅ | Yes | |
| 5 | Migration inventory | ✅ | Yes | No remaining Drizzle usages found |
| 6 | Authentication middleware | ✅ | Yes | |
| 7 | Device session RPCs (atomic) | ✅ | Yes | |
| 8 | Add missing indexes | ✅ | Yes | |
| 8.5 | Drop dead NextAuth tables | ✅ | Yes | |
| 9 | Content sync strategy | ✅ | Yes | Edge-compatible, Category B isolated |
| 10 | Data-leak surface audit | ⏳ | Pending | Next step |
| 11 | Cache safety | ⬜ | | |
| 12 | Cloudflare Workers preparation | ⬜ | | |
| 13 | Load test + deploy | ⬜ | | |
