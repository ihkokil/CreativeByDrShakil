export function checkEnvVariables() {
  // Only log warnings in non-production or if explicitly testing
  // However, for critical secrets like JWT_SECRET, we should warn if it's the default
  const defaultSecret = 'replace_with_a_long_random_secret_at_least_32_chars';
  
  if (process.env.JWT_SECRET === defaultSecret) {
    const errorMessage = '[CRITICAL SECURITY ERROR] Your JWT_SECRET is using the default insecure value! Please update your .env.local file immediately.';
    
    if (process.env.NODE_ENV === 'production') {
      console.error('\x1b[31m%s\x1b[0m', '==================================================');
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      console.error('\x1b[31m%s\x1b[0m', '==================================================');
      throw new Error(errorMessage);
    } else {
      console.warn('\x1b[31m%s\x1b[0m', '==================================================');
      console.warn('\x1b[31m%s\x1b[0m', '[SECURITY WARNING]');
      console.warn('\x1b[31m%s\x1b[0m', errorMessage);
      console.warn('\x1b[31m%s\x1b[0m', '==================================================');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL || '';
    const directUrl = process.env.SUPABASE_DIRECT_URL || '';

    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      throw new Error('SUPABASE_DATABASE_URL must use a PostgreSQL connection string in production.');
    }

    if (!directUrl.startsWith('postgresql://') && !directUrl.startsWith('postgres://')) {
      throw new Error('SUPABASE_DIRECT_URL must use a PostgreSQL connection string in production.');
    }
  }
}

// NOTE: Do NOT auto-run on import.
// In Cloudflare Workers, process.env is populated per-request (not at module init).
// Call checkEnvVariables() lazily from prisma.ts when the DB connection is first used.

