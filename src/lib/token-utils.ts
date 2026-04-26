import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createTokenPair() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashToken(token),
  };
}

export function signVerificationToken(payload: { orderId: string; action: 'approve' | 'reject' }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyVerificationToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { orderId: string; action: 'approve' | 'reject' };
  } catch (error) {
    return null;
  }
}
