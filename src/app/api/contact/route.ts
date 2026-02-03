import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import {
  sendContactSubmissionAcknowledgement,
  sendContactSubmissionNotification,
  type ContactIssueType,
} from '@/lib/contact-emails';

export const runtime = 'nodejs';

const ALLOWED_ISSUES: ContactIssueType[] = ['query', 'technical_assistance', 'billing', 'course_access', 'other'];
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
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

    const submission = await prisma.contactSubmission.create({
      data: {
        id: submissionId,
        fullName,
        phone,
        email,
        issueType,
        subject,
        message,
        imageUrls,
      },
    });

    const emailPayload = {
      fullName: submission.fullName,
      email: submission.email,
      phone: submission.phone,
      issueType: submission.issueType as ContactIssueType,
      subject: submission.subject,
      message: submission.message,
      imageUrls: Array.isArray(submission.imageUrls) ? (submission.imageUrls as string[]) : [],
      submissionId: submission.id,
      createdAt: submission.createdAt,
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
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}