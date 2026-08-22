import { getAppUrl, sendMail } from '@/lib/email';
import { formatDateTimeGMT6 } from '@/lib/date-format';

export type ContactIssueType = 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other';

export type ContactSubmissionEmailPayload = {
  fullName: string;
  email: string;
  phone?: string | null;
  issueType?: ContactIssueType;
  subject?: string;
  message: string;
  imageUrls?: string[];
  submissionId: string;
  createdAt: Date | string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getAdminRecipients() {
  const configuredRecipients =
    process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'support@creativebydrshakil.com';

  const list = configuredRecipients
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  if (!list.includes('support@creativebydrshakil.com')) {
    list.push('support@creativebydrshakil.com');
  }

  return list;
}

export function getContactAdminRecipientsList() {
  return getAdminRecipients();
}

/**
 * Modern, responsive HTML email shell with Dr. Shakil brand styling.
 */
function buildModernEmailShell({
  badge,
  title,
  preheader,
  body,
}: {
  badge?: string;
  title: string;
  preheader: string;
  body: string;
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const safeBadge = badge ? escapeHtml(badge) : null;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
        <!-- Preheader -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);border:1px solid #1e293b;">
                
                <!-- Brand Header -->
                <tr>
                  <td style="padding:32px 28px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#b91c1c 100%);text-align:center;">
                    <img src="https://files.creativebydrshakil.com/uploads/logo/logo.webp" alt="Creative by Dr. Shakil" style="height:42px;display:block;margin:0 auto 16px;max-width:200px;" />
                    ${safeBadge ? `<span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">${safeBadge}</span>` : ''}
                    <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${safeTitle}</h1>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding:32px 28px;background-color:#ffffff;">
                    ${body}
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

/**
 * Sends a notification copy of the new contact message to support@creativebydrshakil.com (Admin).
 */
export async function sendContactSubmissionNotification(submission: ContactSubmissionEmailPayload) {
  const appUrl = getAppUrl();
  const detailsUrl = `${appUrl}/admin/dashboard/support`;
  const formattedDate = formatDateTimeGMT6(submission.createdAt);
  const phoneDisplay = submission.phone?.trim() ? escapeHtml(submission.phone) : '<em style="color:#94a3b8;font-style:normal;">Not provided</em>';

  const html = buildModernEmailShell({
    badge: 'Admin Alert',
    title: 'New Message / Complain Received',
    preheader: `Message from ${submission.fullName} (${submission.email})`,
    body: `
      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
        A new contact message or complain has been submitted through the public contact form.
      </p>

      <!-- Details Summary Card -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:24px;">
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;width:140px;color:#64748b;font-size:13px;font-weight:600;">Full Name</td>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(submission.fullName)}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Email</td>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;"><a href="mailto:${escapeHtml(submission.email)}" style="color:#b91c1c;text-decoration:none;">${escapeHtml(submission.email)}</a></td>
        </tr>
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Phone</td>
          <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;">${phoneDisplay}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;color:#64748b;font-size:13px;font-weight:600;">Submitted At</td>
          <td style="padding:14px 18px;color:#0f172a;font-size:13px;font-weight:600;">${formattedDate} (GMT+6)</td>
        </tr>
      </table>

      <!-- Message / Complain Box -->
      <div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">
          Message / Complain:
        </div>
        <div style="padding:18px 20px;background-color:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #b91c1c;border-radius:10px;font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">
${escapeHtml(submission.message)}
        </div>
      </div>

      ${submission.imageUrls && submission.imageUrls.length > 0 ? `
      <!-- Attached Screenshots -->
      <div style="margin-bottom:28px;padding:16px 18px;background-color:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;">
        <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
          Attached Screenshots (${submission.imageUrls.length}):
        </div>
        <ul style="margin:0;padding-left:20px;color:#334155;">
          ${submission.imageUrls.map((url, idx) => `<li style="margin-bottom:6px;"><a href="${escapeHtml(url)}" target="_blank" style="color:#b91c1c;font-weight:700;text-decoration:underline;">View Screenshot #${idx + 1} &rarr;</a></li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <!-- Action Button -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 16px;">
        <tr>
          <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);">
            <a href="${escapeHtml(detailsUrl)}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
              Open Admin Support Panel &rarr;
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        Reference ID: ${escapeHtml(submission.submissionId)}
      </p>
    `,
  });

  const recipients = getAdminRecipients();

  const attachmentsText = submission.imageUrls && submission.imageUrls.length > 0
    ? `\n\nAttachments:\n${submission.imageUrls.map((url, idx) => `[${idx + 1}] ${url}`).join('\n')}`
    : '';

  await sendMail({
    to: recipients,
    subject: `[Contact / Complain] ${submission.fullName} - ${submission.email}`,
    text: `New contact message from ${submission.fullName} (${submission.email}):\n\nPhone: ${submission.phone || 'N/A'}\nDate: ${formattedDate}\n\nMessage:\n${submission.message}${attachmentsText}\n\nView in Admin Dashboard: ${detailsUrl}`,
    html,
  });
}

/**
 * Sends an automated confirmation receipt to the user who contacted the platform.
 */
export async function sendContactSubmissionAcknowledgement(submission: ContactSubmissionEmailPayload) {
  const appUrl = getAppUrl();

  const html = buildModernEmailShell({
    badge: 'Support Confirmation',
    title: 'We Received Your Message',
    preheader: 'Thanks for reaching out. We have received your message / complain.',
    body: `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;font-weight:700;color:#0f172a;">
        Hi ${escapeHtml(submission.fullName)},
      </p>
      <p style="margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#334155;">
        Thank you for getting in touch with <strong>Creative by Dr. Shakil</strong>. We have safely logged your message / complain, and our support team will review and reply to you directly via this email address.
      </p>

      <div style="margin-bottom:24px;padding:18px 20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #b91c1c;border-radius:10px;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Your Message Summary</div>
        <div style="font-size:14px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${escapeHtml(submission.message)}</div>
      </div>

      <p style="margin:0 0 24px 0;font-size:13px;line-height:1.7;color:#64748b;">
        If you need to add any additional details or documents, you can simply reply to this email or reach us directly at <a href="mailto:support@creativebydrshakil.com" style="color:#b91c1c;font-weight:600;text-decoration:none;">support@creativebydrshakil.com</a>.
      </p>

      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:10px;background:#0f172a;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
              Visit Website
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  await sendMail({
    to: submission.email,
    subject: 'We received your message - Creative by Dr. Shakil Support',
    text: `Hi ${submission.fullName},\n\nThank you for contacting Creative by Dr. Shakil. We have received your message / complain and will reply to you as soon as possible.\n\nYour message:\n${submission.message}\n\nSupport Email: support@creativebydrshakil.com`,
    html,
  });
}