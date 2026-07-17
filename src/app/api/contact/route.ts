import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabase } from '@/lib/db';
import {
  sendContactSubmissionAcknowledgement,
  sendContactSubmissionNotification,
  type ContactIssueType,
} from '@/lib/contact-emails';


export const maxDuration = 60;


const ALLOWED_ISSUES: ContactIssueType[] = ['query', 'technical_assistance', 'billing', 'course_access', 'other'];
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

export async function POST(request: NextRequest) {
  const submissionId = crypto.randomUUID();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'contact-submissions', submissionId);

  try {
    // Check Content-Length before parsing
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Request payload too large. Maximum 50MB allowed.' }, { status: 413 });
    }

    const formData = await request.formData();
    const fullName = String(formData.get('fullName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const issueType = String(formData.get('issueType') || '').trim() as ContactIssueType;
    const subject = String(formData.get('subject') || '').trim();
    const message = String(formData.get('message') || '').trim();
    const imageEntries = formData.getAll('images').filter((item): item is File => item instanceof File && item.size > 0);

    if (!fullName || !phone || !email || !issueType || !subject || !message) {
      return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
    }

    if (!ALLOWED_ISSUES.includes(issueType)) {
      return NextResponse.json({ error: 'Please choose a valid issue type.' }, { status: 400 });
    }

    if (imageEntries.length > MAX_IMAGES) {
      return NextResponse.json({ error: 'You can upload up to 3 images.' }, { status: 400 });
    }

    await fs.mkdir(uploadDir, { recursive: true });

    const imageUrls: string[] = [];

    for (const [index, image] of imageEntries.entries()) {
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return NextResponse.json({ error: 'Only JPG, PNG, WEBP, and GIF images are allowed.' }, { status: 400 });
      }

      if (image.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json({ error: 'Each image must be 5MB or smaller.' }, { status: 400 });
      }

      const safeName = sanitizeFileName(image.name || `image-${index + 1}.png`);
      const ext = path.extname(safeName) || '.png';
      const fileName = `${index + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const relativePath = path.posix.join('uploads', 'contact-submissions', submissionId, fileName);
      const absolutePath = path.join(uploadDir, fileName);

      const arrayBuffer = await image.arrayBuffer();
      await fs.writeFile(absolutePath, Buffer.from(arrayBuffer));
      imageUrls.push(`/${relativePath}`);
    }

    const insertValues = {
        id: submissionId,
        fullName,
        phone,
        email,
        issueType,
        subject,
        message,
        imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        status: 'open',
    };

    const supabase = getSupabase();
    const { error: insertError } = await supabase.from('ContactSubmission').insert(insertValues);
    if (insertError) throw insertError;
    
    const { data: submissionRow } = await supabase.from('ContactSubmission').select('*').eq('id', submissionId).limit(1).maybeSingle();
    const submission = submissionRow || {
        ...insertValues,
        adminReply: null,
        adminReplySentAt: null,
        repliedByAdminId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    let parsedImageUrls: string[] = [];
    try {
      if (submission.imageUrls) {
        const raw = submission.imageUrls;
        parsedImageUrls = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      }
    } catch {
      parsedImageUrls = [];
    }

    const emailPayload = {
      fullName: submission.fullName,
      email: submission.email,
      phone: submission.phone,
      issueType: submission.issueType as ContactIssueType,
      subject: submission.subject,
      message: submission.message,
      imageUrls: parsedImageUrls,
      submissionId: submission.id,
      createdAt: new Date(submission.createdAt),
    };

    await Promise.allSettled([
      sendContactSubmissionNotification(emailPayload),
      sendContactSubmissionAcknowledgement(emailPayload),
    ]);

    return NextResponse.json({
      submission: {
        id: submission.id,
        createdAt: submission.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    await fs.rm(uploadDir, { recursive: true, force: true }).catch(() => undefined);
    console.error('[Contact Submission Error]', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    // Check if it's a payload size error
    if (error?.message?.includes('PAYLOAD') || error?.code === 'PAYLOAD_TOO_LARGE') {
      return NextResponse.json({ error: 'Images are too large. Please reduce file sizes or upload fewer images.' }, { status: 413 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to process your submission. Please try again.' }, { status: 500 });
  }
}