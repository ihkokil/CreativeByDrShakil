import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/db';
import { uploadFileToStorage } from '@/utils/storage';
import {
  sendContactSubmissionAcknowledgement,
  sendContactSubmissionNotification,
  type ContactIssueType,
} from '@/lib/contact-emails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

export async function POST(request: NextRequest) {
  const submissionId = crypto.randomUUID();

  try {
    let fullName = '';
    let email = '';
    let phone = '';
    let message = '';
    let subject = '';
    let issueType: ContactIssueType = 'query';
    const imageUrls: string[] = [];

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      fullName = String(body.fullName || '').trim();
      email = String(body.email || '').trim();
      phone = String(body.phone || '').trim();
      message = String(body.message || '').trim();
      subject = String(body.subject || '').trim();
      if (body.issueType) issueType = body.issueType;
    } else {
      const formData = await request.formData();
      fullName = String(formData.get('fullName') || '').trim();
      email = String(formData.get('email') || '').trim();
      phone = String(formData.get('phone') || '').trim();
      message = String(formData.get('message') || '').trim();
      subject = String(formData.get('subject') || '').trim();
      const rawIssue = String(formData.get('issueType') || '').trim();
      if (rawIssue) issueType = rawIssue as ContactIssueType;

      const imageEntries = formData.getAll('images').filter((item): item is File => item instanceof File && item.size > 0);

      if (imageEntries.length > MAX_IMAGES) {
        return NextResponse.json({ error: `You can upload up to ${MAX_IMAGES} images.` }, { status: 400 });
      }

      for (const [index, image] of imageEntries.entries()) {
        if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
          return NextResponse.json({ error: 'Only JPG, PNG, WEBP, and GIF images are allowed.' }, { status: 400 });
        }

        if (image.size > MAX_IMAGE_SIZE_BYTES) {
          return NextResponse.json({ error: 'Each image must be 10MB or smaller.' }, { status: 400 });
        }

        const safeName = sanitizeFileName(image.name || `screenshot-${index + 1}.png`);
        const ext = path.extname(safeName) || '.png';
        const fileName = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
          const publicUrl = await uploadFileToStorage(
            buffer,
            fileName,
            image.type,
            'uploads/contact-submissions'
          );
          imageUrls.push(publicUrl);
        } catch (uploadErr) {
          console.error('[Contact Image Upload Error]', uploadErr);
        }
      }
    }

    if (!fullName) {
      return NextResponse.json({ error: 'Please provide your full name.' }, { status: 400 });
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'Please enter your message or complain.' }, { status: 400 });
    }

    // Default subject if not provided
    if (!subject) {
      subject = message.length > 50 ? `${message.slice(0, 47)}...` : message;
    }

    const nowStr = new Date().toISOString();

    const insertValues = {
      id: submissionId,
      fullName,
      phone: phone || null,
      email,
      issueType: issueType || 'query',
      subject: subject || 'Message / Complain',
      message,
      imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      status: 'open',
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('ContactSubmission')
      // @ts-ignore
      .insert(insertValues);

    if (insertError) throw insertError;

    const emailPayload = {
      fullName,
      email,
      phone: phone || null,
      issueType,
      subject: insertValues.subject,
      message,
      imageUrls,
      submissionId,
      createdAt: new Date(),
    };

    // Send admin notification to support@creativebydrshakil.com and user confirmation
    Promise.allSettled([
      sendContactSubmissionNotification(emailPayload),
      sendContactSubmissionAcknowledgement(emailPayload),
    ]).catch((err) => console.error('[Contact Email Dispatch Error]', err));

    return NextResponse.json({
      success: true,
      submission: {
        id: submissionId,
        imageUrls,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Contact Submission Error]', error);
    return NextResponse.json({ error: error?.message || 'Failed to process your submission. Please try again.' }, { status: 500 });
  }
}