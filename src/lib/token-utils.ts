import { SignJWT, jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'default-secret-change-me';
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string): Promise<string> {
  // Use Web Crypto API (available in Workers and Node.js 18+)
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(token))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
}

export async function createTokenPair() {
  // Use Web Crypto API for random bytes
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    token,
    tokenHash: await hashToken(token),
  };
}

export async function signVerificationToken(payload: { orderId: string; action: 'approve' | 'reject' }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyVerificationToken(token: string): Promise<{ orderId: string; action: 'approve' | 'reject' } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as { orderId: string; action: 'approve' | 'reject' };
  } catch {
    return null;
  }
}
