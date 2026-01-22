import { getAppUrl, sendMail } from "@/lib/email";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createEmailTemplate({
  preheader,
  heading,
  greeting,
  lead,
  actionLabel,
  actionUrl,
  expiryText,
  warningText,
}: {
  preheader: string;
  heading: string;
  greeting: string;
  lead: string;
  actionLabel: string;
  actionUrl: string;
  expiryText: string;
  warningText: string;
}) {
  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);
  const safeGreeting = escapeHtml(greeting);
  const safeLead = escapeHtml(lead);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeExpiryText = escapeHtml(expiryText);
  const safeWarningText = escapeHtml(warningText);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeHeading}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
                <tr>
                  <td style="padding:18px 24px;background:linear-gradient(120deg,#1d4ed8,#2563eb);color:#ffffff;">
                    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;font-weight:700;">CreativeByDrShakil</div>
                    <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:800;">${safeHeading}</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 10px;font-size:16px;line-height:1.6;font-weight:700;">${safeGreeting}</p>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">${safeLead}</p>

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 18px;">
                      <tr>
                        <td style="border-radius:10px;background:#2563eb;">
                          <a href="${safeActionUrl}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${safeActionLabel}</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:#6b7280;"><strong style="color:#111827;">Link:</strong> <a href="${safeActionUrl}" style="color:#1d4ed8;word-break:break-all;">${safeActionUrl}</a></p>
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:#6b7280;">${safeExpiryText}</p>
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">${safeWarningText}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.7;">
                    This is an automated email from CreativeByDrShakil. Please do not reply directly to this message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

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
  const safeName = escapeHtml(fullName || "there");

  const html = createEmailTemplate({
    preheader: "Verify your account to activate learning access.",
    heading: "Verify Your Email",
    greeting: `Hi ${safeName},`,
    lead: "Thanks for creating your account. Please verify your email address to activate your profile and continue to your dashboard.",
    actionLabel: "Verify Email",
    actionUrl: verifyUrl,
    expiryText: "This verification link will expire in 24 hours.",
    warningText: "If you did not create this account, you can safely ignore this email.",
  });

  await sendMail({
    to: email,
    subject: "Verify your CreativeByDrShakil account",
    text: `Hi ${fullName},\n\nPlease verify your account by visiting this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html,
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
  const safeName = escapeHtml(fullName || "there");

  const html = createEmailTemplate({
    preheader: "Password reset request for your account.",
    heading: "Reset Your Password",
    greeting: `Hi ${safeName},`,
    lead: "We received a request to reset your password. Use the button below to set a new password for your account.",
    actionLabel: "Reset Password",
    actionUrl: resetUrl,
    expiryText: "This reset link will expire in 1 hour.",
    warningText: "If you did not request a password reset, you can ignore this email and your password will remain unchanged.",
  });

  await sendMail({
    to: email,
    subject: "Reset your CreativeByDrShakil password",
    text: `Hi ${fullName},\n\nReset your password using this link:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html,
  });
}
