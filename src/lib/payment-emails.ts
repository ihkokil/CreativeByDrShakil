import { sendMail, getAppUrl } from './email';
import { signVerificationToken } from './token-utils';

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendPaymentVerificationEmail({
  to,
  studentName,
  courseTitle,
  amount,
  transactionId,
  phoneNumber,
  orderId,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  amount: number;
  transactionId: string;
  phoneNumber: string;
  orderId: string;
}) {
  const approveToken = await signVerificationToken({ orderId, action: 'approve' });
  const rejectToken = await signVerificationToken({ orderId, action: 'reject' });

  const appUrl = getAppUrl();
  const approveUrl = `${appUrl}/api/payments/verify?token=${approveToken}`;
  const rejectUrl = `${appUrl}/api/payments/verify?token=${rejectToken}`;

  const subject = `Verify Payment: ${studentName} - ${courseTitle}`;

  const safeStudentName = escapeHtml(studentName);
  const safeCourseTitle = escapeHtml(courseTitle);
  const safeAmount = escapeHtml(amount);
  const safePhone = escapeHtml(phoneNumber);
  const safeTxId = escapeHtml(transactionId);
  const safeOrderId = escapeHtml(orderId);

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Payment Verification Required</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Payment verification request for ${safeStudentName} (${safeCourseTitle})</div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);border:1px solid #1e293b;">
                
                <!-- Brand Header with Signature Gradient -->
                <tr>
                  <td style="padding:32px 28px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#b91c1c 100%);text-align:center;">
                    <img src="https://files.creativebydrshakil.com/logo/creative-by-dr-shakil-logo.svg" alt="Creative by Dr. Shakil" style="height:42px;display:block;margin:0 auto 16px;max-width:200px;" />
                    <span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">Payment Verification</span>
                    <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Review Payment Submission</h1>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding:32px 28px;background-color:#ffffff;">
                    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
                      A student has submitted a payment via bKash. Please review the details below:
                    </p>

                    <!-- Details Summary Card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:28px;">
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;width:140px;color:#64748b;font-size:13px;font-weight:600;">Student Name</td>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;">${safeStudentName}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Course</td>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;">${safeCourseTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Payable Amount</td>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#b91c1c;font-size:16px;font-weight:800;">৳${safeAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Sender Phone</td>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;font-family:monospace;">${safePhone}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;">Transaction ID</td>
                        <td style="padding:14px 18px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:700;font-family:monospace;">${safeTxId}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;color:#64748b;font-size:13px;font-weight:600;">Order ID</td>
                        <td style="padding:14px 18px;color:#64748b;font-size:13px;font-family:monospace;">${safeOrderId}</td>
                      </tr>
                    </table>

                    <!-- Actions -->
                    <div style="text-align:center;margin-bottom:24px;">
                      <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Action Decision</p>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                        <tr>
                          <td style="padding-right:12px;">
                            <a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">
                              ✅ Approve Enrollment
                            </a>
                          </td>
                          <td>
                            <a href="${rejectUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">
                              ❌ Reject Payment
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
                      Clicking either button performs the decision immediately without login requirement. This link is valid for 7 days.
                    </p>
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

  const text = `
Payment Verification Required

Student: ${studentName}
Course: ${courseTitle}
Amount: ৳${amount}
Phone: ${phoneNumber}
TXID: ${transactionId}
Order ID: ${orderId}

Approve: ${approveUrl}
Reject: ${rejectUrl}
  `;

  await sendMail({ to, subject, html, text });
}
