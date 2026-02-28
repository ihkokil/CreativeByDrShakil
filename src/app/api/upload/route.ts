import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayload } from '@/lib/route-auth';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

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
    // Verify authentication
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided or invalid file' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'course-thumbnails', payload.sub);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeFileName(file.name || 'thumbnail.jpg');
    const ext = path.extname(safeName) || '.jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const absolutePath = path.join(uploadDir, fileName);
    const relativePath = path.posix.join('uploads', 'course-thumbnails', payload.sub, fileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(absolutePath, Buffer.from(arrayBuffer));

    return NextResponse.json(
      {
        success: true,
        url: `/${relativePath}`,
        storagePath: relativePath,
        filename: file.name,
        bytes: file.size,
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
