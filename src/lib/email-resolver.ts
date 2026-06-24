export const DEFAULT_EMAIL_DOMAIN = 
  process.env.NEXT_PUBLIC_DEFAULT_EMAIL_DOMAIN || 
  process.env.DEFAULT_EMAIL_DOMAIN || 
  "creativebydrshakil.com";

/**
 * Resolves user input into a full email address.
 * If the input already contains '@', it is treated as a full email and trimmed.
 * If the input does not contain '@', the default domain is internally appended.
 * 
 * @param input The email input string from user.
 * @returns Resolved email address.
 */
export function resolveEmail(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`;
}

/**
 * Validates resolved email format.
 */
export function validateEmail(resolvedEmail: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(resolvedEmail);
}

