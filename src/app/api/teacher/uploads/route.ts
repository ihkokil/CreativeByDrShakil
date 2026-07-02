import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { requireTeacherPayload } from '@/lib/route-auth';
import { uploadFileToStorage } from '@/utils/storage';



const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const formData = await request.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'Missing file upload.' }, { status: 400 });
    }

    if (!ALLOWED_VIDEO_TYPES.has(uploaded.type) && !ALLOWED_DOCUMENT_TYPES.has(uploaded.type)) {
      return NextResponse.json({ error: 'Unsupported file format.' }, { status: 400 });
    }

    if (uploaded.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 1GB.' }, { status: 400 });
    }

    // Store teacher uploads using Hostinger storage API
    const folderPath = path.posix.join('uploads', 'teacher-library', payload.sub);

    const safeName = sanitizeFileName(uploaded.name || 'upload.mp4');
    const ext = path.extname(safeName) || '.mp4';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    const arrayBuffer = await uploaded.arrayBuffer();
    
    // Use the existing storage utility
    const fileUrl = await uploadFileToStorage(
      Buffer.from(arrayBuffer),
      fileName,
      uploaded.type,
      folderPath
    );

    return NextResponse.json({
      url: fileUrl,
      storagePath: `${folderPath}/${fileName}`,
      fileName,
      bytes: uploaded.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
