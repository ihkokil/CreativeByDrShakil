import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true;
  const user = process.env.SMTP_USER || "no-reply@creativebydrshakil.com";
  const pass = process.env.SMTP_PASS;

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

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(getSmtpConfig());
  }
  return transporter;
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
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@creativebydrshakil.com";

  await getTransporter().sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}
