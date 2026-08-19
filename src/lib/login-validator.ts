export type ValidationResult =
  | { valid: true; email: string }
  | { valid: false; reason: string };

export function isPhoneNumber(input: string): boolean {
  const cleaned = input.trim().replace(/[\s-]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned);
}

export function normalizeLoginIdentifier(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, reason: "Please enter your email address." };
  }

  if (isPhoneNumber(trimmed)) {
    return { valid: false, reason: "Please enter your email address. Phone numbers are not supported for login." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: "Please enter a valid email address." };
  }

  return { valid: true, email: trimmed };
}
