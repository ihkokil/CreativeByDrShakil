import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contactSubmission as csSchema, user as userSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { sendMail } from '@/lib/email';
import { type ContactIssueType } from '@/lib/contact-emails';

function normalizeSubmission(submission: any) {
  let parsedImageUrls = [];
  if (typeof submission.imageUrls === 'string') {
    try { parsedImageUrls = JSON.parse(submission.imageUrls); } catch (e) {}
  } else if (Array.isArray(submission.imageUrls)) {
    parsedImageUrls = submission.imageUrls;
  }
  return {
    ...submission,
    imageUrls: parsedImageUrls,
  };
}

function issueLabel(issueType: ContactIssueType) {
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const resolvedParams = await params;
    const [submission] = await db.select().from(csSchema).where(eq(csSchema.id, resolvedParams.id)).limit(1);

    if (!submission) {
      return NextResponse.json({ error: 'Contact submission not found.' }, { status: 404 });
    }

    if (submission.repliedByAdminId) {
      const [admin] = await db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email }).from(userSchema).where(eq(userSchema.id, submission.repliedByAdminId)).limit(1);
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

    const [existing] = await db.select().from(csSchema).where(eq(csSchema.id, resolvedParams.id)).limit(1);

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
      updateData.adminReplySentAt = new Date();
      updateData.repliedByAdminId = adminCheck.payload?.sub;
      updateData.status = normalizedStatus || 'responded';
    }

    await db.update(csSchema)
      .set(updateData)
      .where(eq(csSchema.id, resolvedParams.id));

    const [updatedSubmission] = await db.select().from(csSchema).where(eq(csSchema.id, resolvedParams.id)).limit(1);

    if (!updatedSubmission) {
      return NextResponse.json({ error: 'Submission not found after update.' }, { status: 404 });
    }

    let replyEmailSent = false;

    if (adminReply && sendReplyEmail) {
      try {
        const issue = issueLabel(updatedSubmission.issueType as ContactIssueType);
        const subject = `Response to your CreativeByDrShakil support request: ${updatedSubmission.subject}`;
        const text = `Hi ${updatedSubmission.fullName},\n\n${adminReply}\n\nOriginal request subject: ${updatedSubmission.subject}\nIssue type: ${issue}`;
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.7;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <div style="padding:24px;background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);color:#ffffff;text-align:center;">
              <img src="https://files.creativebydrshakil.com/uploads/logo/logo.webp" alt="Creative by Dr. Shakil" style="height:36px;display:block;margin:0 auto 12px;" />
              <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:800;text-align:center;">Support Request Response</h1>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-weight:700;">Hi ${updatedSubmission.fullName},</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#374151;">${adminReply.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>
              
              <div style="padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;">
                <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Original Request</p>
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${updatedSubmission.subject}</p>
                <p style="margin:0;font-size:13px;color:#6b7280;">Issue Type: ${issue}</p>
              </div>
            </div>
            <div style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.7;text-align:center;">
              This is an automated email from Creative By Dr. Shakil. Please do not reply directly to this message.
            </div>
          </div>
        `;

        await sendMail({
          to: updatedSubmission.email,
          subject,
          text,
          html,
        });

        replyEmailSent = true;
      } catch {
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