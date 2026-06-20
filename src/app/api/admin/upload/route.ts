import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import path from 'path';
import { uploadFileToStorage } from '@/utils/storage';



async function requireAdmin(request: NextRequest) {
  const bearerToken = extractBearerToken(request)
  const cookieToken = await extractCookieToken()
  const token = bearerToken || cookieToken

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const payload = verifyAuthToken(token)
  if (payload.role !== 'admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }) }
  }

  return { ok: true as const }
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided or invalid file' },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    const safeName = sanitizeFileName(file.name || 'qr.png');
    const ext = path.extname(safeName) || '.png';
    const fileName = `bkash-qr${ext}`;
    const folderPath = `uploads/bkash-qr`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicUrl = await uploadFileToStorage(buffer, fileName, file.type, folderPath);

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}