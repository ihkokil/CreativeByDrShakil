import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { sendMail } from '@/lib/email';
import { type ContactIssueType } from '@/lib/contact-emails';

export const dynamic = 'force-dynamic';

function normalizeSubmission(submission: any) {
  let parsedImageUrls = [];
  if (typeof submission.imageUrls === 'string') {
    try {
      parsedImageUrls = JSON.parse(submission.imageUrls);
    } catch (e) {}
  } else if (Array.isArray(submission.imageUrls)) {
    parsedImageUrls = submission.imageUrls;
  }
  return {
    ...submission,
    imageUrls: parsedImageUrls,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const resolvedParams = await params;
    const supabase = getSupabaseAdmin();

    const { data: submission } = await supabase
      .from('ContactSubmission')
      .select('*')
      .eq('id', resolvedParams.id)
      .limit(1)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json({ error: 'Contact submission not found.' }, { status: 404 });
    }

    if ((submission as any).repliedByAdminId) {
      const { data: admin } = await supabase
        .from('User')
        .select('id, fullName, email')
        .eq('id', (submission as any).repliedByAdminId)
        .limit(1)
        .maybeSingle();

      (submission as any).repliedByAdmin = admin || null;
    }

    return NextResponse.json({ submission: normalizeSubmission(submission) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const resolvedParams = await params;
    const body = await request.json();
    const status = String(body?.status || '').trim();
    const adminReply = typeof body?.adminReply === 'string' ? body.adminReply.trim() : '';
    const sendReplyEmail = Boolean(body?.sendReplyEmail ?? true);

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('ContactSubmission')
      .select('id')
      .eq('id', resolvedParams.id)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Contact submission not found.' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    const normalizedStatus = ['open', 'in_review', 'responded', 'closed'].includes(status)
      ? status
      : undefined;

    if (normalizedStatus) {
      updateData.status = normalizedStatus;
    }

    if (adminReply) {
      updateData.adminReply = adminReply;
      updateData.adminReplySentAt = new Date().toISOString();
      updateData.repliedByAdminId = adminCheck.payload?.sub;
      updateData.status = normalizedStatus || 'responded';
    }

    const { error: updateError } = await supabase
      .from('ContactSubmission')
      // @ts-ignore
      .update(updateData)
      .eq('id', resolvedParams.id);

    if (updateError) throw updateError;

    const { data: updatedSubmission } = await supabase
      .from('ContactSubmission')
      .select('*')
      .eq('id', resolvedParams.id)
      .limit(1)
      .maybeSingle();

    if (!updatedSubmission) {
      return NextResponse.json({ error: 'Submission not found after update.' }, { status: 404 });
    }

    let replyEmailSent = false;

    if (adminReply && sendReplyEmail) {
      try {
        const userEmail = (updatedSubmission as any).email;
        const userName = (updatedSubmission as any).fullName;
        const userMsg = (updatedSubmission as any).message || (updatedSubmission as any).subject;

        const html = `
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Response to your message</title>
            </head>
            <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:32px 12px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.25);border:1px solid #1e293b;">
                      <tr>
                        <td style="padding:32px 28px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#b91c1c 100%);text-align:center;">
                          <img src="https://files.creativebydrshakil.com/logo/creative-by-dr-shakil-logo.svg" alt="Creative by Dr. Shakil" style="height:42px;display:block;margin:0 auto 16px;max-width:200px;" />
                          <span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">Support Response</span>
                          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Response to Your Support Request</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:32px 28px;background-color:#ffffff;">
                          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;font-weight:700;color:#0f172a;">Hi ${userName},</p>
                          <p style="margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#334155;">
                            Our team has reviewed your message / complain and provided the following response:
                          </p>
                          
                          <div style="margin-bottom:24px;padding:18px 20px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:10px;">
                            <div style="font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Admin Response</div>
                            <div style="font-size:14px;line-height:1.7;color:#14532d;white-space:pre-wrap;">${adminReply.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>
                          </div>

                          <div style="margin-bottom:24px;padding:16px 18px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                            <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Your Original Message</div>
                            <div style="font-size:13px;line-height:1.6;color:#475569;white-space:pre-wrap;">${userMsg.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>
                          </div>

                          <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">
                            If you have further questions or need additional assistance, please reply to this email or reach us at <a href="mailto:support@creativebydrshakil.com" style="color:#b91c1c;font-weight:600;text-decoration:none;">support@creativebydrshakil.com</a>.
                          </p>
                        </td>
                      </tr>
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

        const subject = `[Support Response] Re: ${(updatedSubmission as any).subject || 'Your Message'}`;
        const text = `Hi ${userName},\n\nOur team has responded to your message:\n\n${adminReply}\n\n---\nOriginal Message:\n${userMsg}\n\nSupport Email: support@creativebydrshakil.com`;

        // Send to student and copy to support@creativebydrshakil.com
        await Promise.allSettled([
          sendMail({
            to: userEmail,
            subject,
            text,
            html,
          }),
          sendMail({
            to: 'support@creativebydrshakil.com',
            subject: `[Copy - Sent to ${userName}] ${subject}`,
            text: `(Copy of response sent to ${userName} <${userEmail}>)\n\nResponse:\n${adminReply}\n\nOriginal Message:\n${userMsg}`,
            html,
          }),
        ]);

        replyEmailSent = true;
      } catch (err) {
        console.error('[Admin Reply Email Error]', err);
        replyEmailSent = false;
      }
    }

    return NextResponse.json({
      submission: normalizeSubmission(updatedSubmission),
      replyEmailSent,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}