# Cloudflare Workers Secrets Checklist

The following environment variables must be securely added to your Cloudflare Workers environment using `npx wrangler secret put <SECRET_NAME>`.

## Supabase HTTP API Keys (Replicas)
- `SUPABASE_URL_1`
- `SUPABASE_ANON_KEY_1`
- `SUPABASE_URL_2`
- `SUPABASE_ANON_KEY_2`
- `SUPABASE_URL_3`
- `SUPABASE_ANON_KEY_3`
- `SUPABASE_URL_4`
- `SUPABASE_ANON_KEY_4`
- `SUPABASE_URL_5`
- `SUPABASE_ANON_KEY_5`

## Supabase Service Role Keys (Bypass RLS, used only by `getSupabaseAdmin`)
- `SUPABASE_URL` (Primary Backup DB)
- `SUPABASE_SERVICE_ROLE_KEY`

## Authentication & Security
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

## Third-Party Integrations
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`

## App Configuration
- `APP_URL`
- `HOSTINGER_UPLOAD_TOKEN`

## Note on Public Variables
Variables starting with `NEXT_PUBLIC_` or variables that are safely embedded into the build (e.g., `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FILE_URL`) do not necessarily need to be stored as secrets in Cloudflare if they are already baked in at build time, but can be provided as plaintext `[vars]` in `wrangler.toml` if dynamic evaluation is needed.

**No TCP drivers or direct DB connection strings (like `SUPABASE_DB_URL_X`) should be added to Cloudflare, as Workers use the HTTP API via Supabase JS exclusively.**
