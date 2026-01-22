import { getAppUrl, sendMail } from "@/lib/email";

export async function sendVerificationEmail({
  email,
  fullName,
  token,
}: {
  email: string;
  fullName: string;
  token: string;
}) {
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

  await sendMail({
    to: email,
    subject: "Verify your CreativeByDrShakil account",
    text: `Hi ${fullName}, verify your account using this link: ${verifyUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Welcome to CreativeByDrShakil</h2>
        <p>Hi ${fullName},</p>
        <p>Thanks for signing up. Please verify your email address to activate your account.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  email,
  fullName,
  token,
}: {
  email: string;
  fullName: string;
  token: string;
}) {
  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: "Reset your CreativeByDrShakil password",
    text: `Hi ${fullName}, reset your password using this link: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Password Reset Request</h2>
        <p>Hi ${fullName},</p>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}
