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
  badge,
  preheader,
  heading,
  greeting,
  lead,
  actionLabel,
  actionUrl,
  otpCode,
  expiryText,
  warningText,
}: {
  badge?: string;
  preheader: string;
  heading: string;
  greeting: string;
  lead: string;
  actionLabel?: string;
  actionUrl?: string;
  otpCode?: string;
  expiryText: string;
  warningText: string;
}) {
  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);
  const safeBadge = badge ? escapeHtml(badge) : null;
  const safeGreeting = escapeHtml(greeting);
  const safeLead = escapeHtml(lead);
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : "";
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : "";
  const safeOtpCode = otpCode ? escapeHtml(otpCode) : "";
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
      <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
        <!-- Preheader -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);border:1px solid #1e293b;">
                
                <!-- Brand Header with Signature Gradient -->
                <tr>
                  <td style="padding:32px 28px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#b91c1c 100%);text-align:center;">
                    <img src="https://files.creativebydrshakil.com/logo/creative-by-dr-shakil-logo.svg" alt="Creative by Dr. Shakil" style="height:42px;display:block;margin:0 auto 16px;max-width:200px;" />
                    ${safeBadge ? `<span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">${safeBadge}</span>` : ''}
                    <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${safeHeading}</h1>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding:32px 28px;background-color:#ffffff;">
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.6;font-weight:700;color:#0f172a;">${safeGreeting}</p>
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155;">${safeLead}</p>

                    ${safeOtpCode ? `
                    <div style="margin:28px 0;padding:22px 24px;background:#f8fafc;border-radius:14px;text-align:center;border:1px solid #e2e8f0;border-left:4px solid #b91c1c;">
                      <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px;letter-spacing:0.1em;">Verification Code</div>
                      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:36px;font-weight:800;letter-spacing:0.25em;color:#b91c1c;">${safeOtpCode}</div>
                    </div>
                    ` : safeActionUrl && safeActionLabel ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 20px;">
                      <tr>
                        <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);">
                          <a href="${safeActionUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">${safeActionLabel} &rarr;</a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#64748b;"><strong style="color:#0f172a;">Direct Link:</strong> <a href="${safeActionUrl}" style="color:#b91c1c;word-break:break-all;text-decoration:none;">${safeActionUrl}</a></p>
                    ` : ''}

                    <div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9;">
                      <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#64748b;">${safeExpiryText}</p>
                      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${safeWarningText}</p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 28px;border-top:1px solid #f1f5f9;background-color:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                    <p style="margin:0 0 6px 0;font-weight:600;color:#334155;">Creative by Dr. Shakil &bull; Medical Education Platform</p>
                    <p style="margin:0;font-size:11px;color:#94a3b8;">
                      Official Support: <a href="mailto:support@creativebydrshakil.com" style="color:#b91c1c;text-decoration:none;font-weight:600;">support@creativebydrshakil.com</a>
                    </p>
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
    badge: "Account Activation",
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
    badge: "Security Alert",
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

export async function sendPasswordSetupEmail({
  email,
  fullName,
  token,
}: {
  email: string;
  fullName: string;
  token: string;
}) {
  const appUrl = getAppUrl();
  const setupUrl = `${appUrl}/auth/reset-password?token=${token}`;
  const safeName = escapeHtml(fullName || "there");

  const html = createEmailTemplate({
    badge: "Welcome",
    preheader: "Welcome! Set up your password to access your courses.",
    heading: "Set Up Your Password",
    greeting: `Hi ${safeName},`,
    lead: "Welcome to CreativeByDrShakil! An admin has enrolled you in a course. Please set up your password to access your account and start learning.",
    actionLabel: "Set Password",
    actionUrl: setupUrl,
    expiryText: "This setup link will expire in 24 hours.",
    warningText: "If you did not expect this email, please contact support.",
  });

  await sendMail({
    to: email,
    subject: "Welcome to CreativeByDrShakil - Set Your Password",
    text: `Hi ${fullName},\n\nWelcome to CreativeByDrShakil! An admin has enrolled you in a course. Please set up your password by visiting:\n${setupUrl}\n\nThis link expires in 24 hours.`,
    html,
  });
}

export async function sendOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  const html = createEmailTemplate({
    badge: "Account Verification",
    preheader: "Your OTP verification code for Creative By Dr. Shakil.",
    heading: "Verification Code",
    greeting: "Hello,",
    lead: "Use the verification code below to verify your email address. This code will expire in 30 minutes:",
    otpCode: otp,
    expiryText: "This verification code will expire in 30 minutes.",
    warningText: "If you did not request this code, you can safely ignore this email.",
  });

  await sendMail({
    to: email,
    subject: `Your Verification Code: ${otp}`,
    text: `Hello,\n\nYour verification code is: ${otp}\n\nThis code will expire in 30 minutes.\n\nIf you did not request this, you can safely ignore this email.`,
    html,
  });
}

export async function sendForgotPasswordOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  const html = createEmailTemplate({
    badge: "Password Reset",
    preheader: "Use the OTP code below to reset your password.",
    heading: "Reset Your Password",
    greeting: "Hello,",
    lead: "We received a request to reset your password. Use the verification code below to confirm your request. This code will expire in 15 minutes:",
    otpCode: otp,
    expiryText: "This verification code will expire in 15 minutes.",
    warningText: "If you did not request a password reset, you can safely ignore this email.",
  });

  await sendMail({
    to: email,
    subject: `Reset Password Verification Code: ${otp}`,
    text: `Hello,\n\nYour reset verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`,
    html,
  });
}
