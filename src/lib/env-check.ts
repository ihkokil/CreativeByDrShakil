export function checkEnvVariables() {
  // Only log warnings in non-production or if explicitly testing
  // However, for critical secrets like JWT_SECRET, we should warn if it's the default
  const defaultSecret = 'replace_with_a_long_random_secret_at_least_32_chars';
  
  if (process.env.JWT_SECRET === defaultSecret) {
    console.warn('\x1b[31m%s\x1b[0m', '==================================================');
    console.warn('\x1b[31m%s\x1b[0m', '[CRITICAL SECURITY WARNING]');
    console.warn('\x1b[31m%s\x1b[0m', 'Your JWT_SECRET is using the default insecure value!');
    console.warn('\x1b[31m%s\x1b[0m', 'Please update your .env.local file immediately.');
    console.warn('\x1b[31m%s\x1b[0m', '==================================================');
  }
}

// Run immediately on import
checkEnvVariables();
