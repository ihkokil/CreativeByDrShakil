import { getAppUrl, sendMail } from '@/lib/email';

export type ContactIssueType = 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other';

export type ContactSubmissionEmailPayload = {
  fullName: string;
  email: string;
  phone: string;
  issueType: ContactIssueType;
  subject: string;
  message: string;
  imageUrls: string[];
  submissionId: string;
  createdAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatIssueLabel(issueType: ContactIssueType) {
  switch (issueType) {
    case 'technical_assistance':
      return 'Technical Assistance';
    case 'course_access':
      return 'Course Access';
    case 'billing':
      return 'Billing';
    case 'other':
      return 'Other';
    case 'query':
    default:
      return 'Query';
  }
}

function getAdminRecipients() {
  const configuredRecipients =
    process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'contact@drshakil.com';

  return configuredRecipients
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function buildEmailShell({
  title,
  preheader,
  body,
}: {
  title: string;
  preheader: string;
  body: string;
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
                <tr>
                  <td align="center" style="padding:24px;background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);color:#ffffff;text-align:center;">
                    <img src="https://files.creativebydrshakil.com/uploads/logo/logo.webp" alt="Creative by Dr. Shakil" style="height:36px;display:block;margin:0 auto 12px;filter:brightness(0) invert(1);-webkit-filter:brightness(0) invert(1);" />
                    <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;text-align:center;">${safeTitle}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;">${body}</td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.7;">
                    This is an automated email from Creative By Dr. Shakil. Please do not reply directly to this message.
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

export function getContactAdminRecipientsList() {
  return getAdminRecipients();
}

export async function sendContactSubmissionNotification(submission: ContactSubmissionEmailPayload) {
  const appUrl = getAppUrl();
  const issueLabel = formatIssueLabel(submission.issueType);
  const detailsUrl = `${appUrl}/admin/dashboard?tab=support`;
  const safeImages = submission.imageUrls
    .map((url) => `<li><a href="${escapeHtml(url)}" style="color:#1d4ed8;word-break:break-all;">${escapeHtml(url)}</a></li>`)
    .join('');

  const html = buildEmailShell({
    title: 'New contact request received',
    preheader: `Support request from ${submission.fullName}`,
    body: `
      <p style="margin:0 0 10px;font-size:16px;line-height:1.6;font-weight:700;">A new contact request has been submitted.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
        <tr><td style="color:#6b7280;font-size:13px;width:170px;vertical-align:top;">Full name</td><td style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(submission.fullName)}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Email</td><td style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(submission.email)}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Phone</td><td style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(submission.phone)}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Issue</td><td style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(issueLabel)}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;vertical-align:top;">Subject</td><td style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(submission.subject)}</td></tr>
      </table>
      <div style="margin-top:18px;padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;">
        <div style="font-size:13px;color:#6b7280;font-weight:700;margin-bottom:8px;">Message</div>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#111827;">${escapeHtml(submission.message)}</div>
      </div>
      ${submission.imageUrls.length > 0 ? `<div style="margin-top:18px;"><div style="font-size:13px;color:#6b7280;font-weight:700;margin-bottom:8px;">Attachments</div><ul style="margin:0;padding-left:18px;">${safeImages}</ul></div>` : ''}
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">
        <tr>
          <td style="border-radius:10px;background:#2563eb;"><a href="${escapeHtml(detailsUrl)}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Open Admin Inbox</a></td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Submission ID: ${escapeHtml(submission.submissionId)}</p>
    `,
  });

  const recipients = getAdminRecipients();

  await sendMail({
    to: recipients,
    subject: `New Contact Request: ${submission.subject}`,
    text: `A new contact request has been submitted by ${submission.fullName} (${submission.email}). Subject: ${submission.subject}. Open the admin inbox to review it: ${detailsUrl}`,
    html,
  });
}

export async function sendContactSubmissionAcknowledgement(submission: ContactSubmissionEmailPayload) {
  const appUrl = getAppUrl();
  const issueLabel = formatIssueLabel(submission.issueType);

  const html = buildEmailShell({
    title: 'We received your message',
    preheader: 'Your support request has been received.',
    body: `
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;font-weight:700;">Hi ${escapeHtml(submission.fullName)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Thanks for contacting CreativeByDrShakil. We’ve received your <strong>${escapeHtml(issueLabel.toLowerCase())}</strong> request and our admin team will review it.</p>
      <div style="padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;">
        <div style="font-size:13px;color:#6b7280;font-weight:700;margin-bottom:8px;">Your request summary</div>
        <div style="font-size:14px;line-height:1.7;color:#111827;white-space:pre-wrap;">${escapeHtml(submission.subject)}</div>
      </div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#374151;">If you need to add more details, you can reply to this email or reach us again from the contact page.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
        <tr>
          <td style="border-radius:10px;background:#2563eb;"><a href="${escapeHtml(`${appUrl}/contact`)}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Visit Contact Page</a></td>
        </tr>
      </table>
    `,
  });

  await sendMail({
    to: submission.email,
    subject: 'We received your contact request',
    text: `Hi ${submission.fullName},\n\nWe received your ${issueLabel.toLowerCase()} request and will review it soon.\n\nSubject: ${submission.subject}\n\nYou can visit ${appUrl}/contact if you need to send more details.`,
    html,
  });
}