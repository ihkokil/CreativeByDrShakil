import { sendMail, getAppUrl } from './email';
import { signVerificationToken } from './token-utils';

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
  const approveToken = signVerificationToken({ orderId, action: 'approve' });
  const rejectToken = signVerificationToken({ orderId, action: 'reject' });

  const appUrl = getAppUrl();
  const approveUrl = `${appUrl}/api/payments/verify?token=${approveToken}`;
  const rejectUrl = `${appUrl}/api/payments/verify?token=${rejectToken}`;

  const subject = `Verify Payment: ${studentName} - ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f9; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #edf2f7; padding-bottom: 5px; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #64748b; }
        .value { color: #1e293b; font-family: monospace; }
        .actions { display: flex; gap: 15px; justify-content: center; margin-top: 30px; }
        .btn { text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: 600; font-size: 14px; transition: all 0.2s; }
        .btn-approve { background-color: #10b981; color: white; }
        .btn-reject { background-color: #ef4444; color: white; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; background: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Verification Required</h1>
        </div>
        <div class="content">
          <p>A student has submitted a payment for manual verification. Please review the details below:</p>
          
          <div class="details-box">
            <div class="detail-row">
              <span class="label">Student Name:</span>
              <span class="value">${studentName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Course:</span>
              <span class="value">${courseTitle}</span>
            </div>
            <div class="detail-row">
              <span class="label">Amount:</span>
              <span class="value">৳${amount}</span>
            </div>
            <div class="detail-row">
              <span class="label">Phone:</span>
              <span class="value">${phoneNumber}</span>
            </div>
            <div class="detail-row">
              <span class="label">Transaction ID:</span>
              <span class="value">${transactionId}</span>
            </div>
          </div>

          <p style="text-align: center; font-weight: 600;">Action Required:</p>
          
          <div class="actions">
            <a href="${approveUrl}" class="btn btn-approve">Approve Enrollment</a>
            <a href="${rejectUrl}" class="btn btn-reject">Reject Payment</a>
          </div>

          <p style="margin-top: 30px; font-size: 13px; color: #64748b;">
            Note: Clicking these buttons will perform the action immediately without requiring you to log in. This link is valid for 7 days.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Creative By Dr. Shakil. All rights reserved.
        </div>
      </div>
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
    
    Approve: ${approveUrl}
    Reject: ${rejectUrl}
  `;

  await sendMail({ to, subject, html, text });
}
