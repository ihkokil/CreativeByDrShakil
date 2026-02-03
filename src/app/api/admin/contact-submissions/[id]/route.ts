import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { sendMail } from '@/lib/email';
import { type ContactIssueType } from '@/lib/contact-emails';

function normalizeSubmission(submission: any) {
  return {
    ...submission,
    imageUrls: Array.isArray(submission.imageUrls) ? submission.imageUrls : [],
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
    const submission = await prisma.contactSubmission.findUnique({
      where: { id: resolvedParams.id },
      include: {
        repliedByAdmin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Contact submission not found.' }, { status: 404 });
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

    const existing = await prisma.contactSubmission.findUnique({
      where: { id: resolvedParams.id },
    });

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

    const updatedSubmission = await prisma.contactSubmission.update({
      where: { id: resolvedParams.id },
      data: updateData,
    });

    let replyEmailSent = false;

    if (adminReply && sendReplyEmail) {
      try {
        const issue = issueLabel(updatedSubmission.issueType as ContactIssueType);
        const subject = `Response to your CreativeByDrShakil support request: ${updatedSubmission.subject}`;
        const text = `Hi ${updatedSubmission.fullName},\n\n${adminReply}\n\nOriginal request subject: ${updatedSubmission.subject}\nIssue type: ${issue}`;
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.7;">
            <p style="margin:0 0 12px;">Hi ${updatedSubmission.fullName},</p>
            <p style="margin:0 0 16px;white-space:pre-wrap;">${adminReply.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>
            <div style="padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;font-weight:700;">Original request</p>
              <p style="margin:0;font-size:14px;font-weight:700;">${updatedSubmission.subject}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Issue: ${issue}</p>
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