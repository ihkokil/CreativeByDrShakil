import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
  const fromAddress = process.env.RESEND_FROM_EMAIL || "no-reply@creativebydrshakil.com";
  let from: string;
  if (fromAddress.includes("<") && fromAddress.includes(">")) {
    from = fromAddress;
  } else {
    const fromName = process.env.RESEND_FROM_NAME || "Creative by Dr. Shakil";
    from = `"${fromName}" <${fromAddress}>`;
  }

  try {
    if (!resend) {
      console.warn("RESEND_API_KEY is missing. Email not sent.");
      return;
    }

    const result = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });
    
    if (result.error) {
      throw new Error(`Resend API Error: ${result.error.message}`);
    }
  } catch (error) {
    console.error("Failed to send email", {
      from,
      to,
      subject,
      error,
    });
    throw error;
  }
}

export function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  return url.replace(/"/g, '');
}

