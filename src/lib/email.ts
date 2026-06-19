import { Resend } from "resend";

// Nodemailer is imported lazily only for local development.
// It uses TCP sockets (SMTP) which are NOT supported on Cloudflare Workers.
let nodemailer: typeof import("nodemailer") | null = null;

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true;
  const user = process.env.SMTP_USER || "no-reply@creativebydrshakil.com";
  const pass = process.env.SMTP_PASS?.replace(/"/g, '');

  if (!pass) {
    throw new Error("Missing SMTP_PASS environment variable.");
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
}

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}) {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@creativebydrshakil.com";
  const fromName = process.env.SMTP_FROM_NAME || "Creative by Dr. Shakil";
  const from = `"${fromName}" <${fromAddress}>`;

  try {
    if (resend) {
      // Primary: Send via Resend API (works everywhere including Cloudflare Workers)
      const resendFrom = process.env.RESEND_FROM_EMAIL || "Creative by Dr. Shakil <no-reply@creativebydrshakil.com>";
      const result = await resend.emails.send({
        from: resendFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });
      
      if (result.error) {
        throw new Error(`Resend API Error: ${result.error.message}`);
      }
    } else {
      // Nodemailer SMTP fallback — only works in local Node.js (not Cloudflare Workers)
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'RESEND_API_KEY is required in production. Nodemailer (SMTP) is not supported on Cloudflare Workers.'
        );
      }

      // Lazy-import nodemailer for local dev only
      if (!nodemailer) {
        nodemailer = await import("nodemailer");
      }
      const transporter = nodemailer.createTransport(getSmtpConfig());
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });
    }
  } catch (error) {
    console.error("Failed to send email", {
      from,
      to,
      subject,
      usingResend: !!resend,
      error,
    });
    throw error;
  }
}

export function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  return url.replace(/"/g, '');
}

