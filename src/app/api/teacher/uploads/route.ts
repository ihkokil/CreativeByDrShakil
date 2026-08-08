import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { requireTeacherPayload } from '@/lib/route-auth';

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

const ALLOWED_ZIP_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

function inferContentType(filename: string, contentType?: string | null) {
  const providedType = contentType?.trim();
  if (providedType) return providedType;

  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return MIME_TYPE_BY_EXTENSION[ext] || '';
}

function getMaxUploadBytes(fileType: string): { maxBytes: number; label: string } {
  const isVideo = ALLOWED_VIDEO_TYPES.has(fileType);
  const isDocument = ALLOWED_DOCUMENT_TYPES.has(fileType);
  const isZip = ALLOWED_ZIP_TYPES.has(fileType);

  if (isVideo) {
    const mb = Number(process.env.DEFAULT_VIDEO_MAX_SIZE) || 1024;
    const label = mb >= 1024 ? `${(mb / 1024).toFixed(0)}GB` : `${mb}MB`;
    return { maxBytes: mb * 1024 * 1024, label };
  }

  if (isDocument) {
    const mb = Number(process.env.DEFAULT_DOC_MAX_SIZE) || 50;
    const label = mb >= 1024 ? `${(mb / 1024).toFixed(0)}GB` : `${mb}MB`;
    return { maxBytes: mb * 1024 * 1024, label };
  }

  if (isZip) {
    const mb = Number(process.env.DEFAULT_ZIP_MAX_SIZE) || 500;
    const label = mb >= 1024 ? `${(mb / 1024).toFixed(0)}GB` : `${mb}MB`;
    return { maxBytes: mb * 1024 * 1024, label };
  }

  return { maxBytes: 0, label: '' };
}

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

    const body = await request.json();
    const { filename, size, contentType } = body;
    const resolvedContentType = inferContentType(filename || '', contentType);

    if (!filename || !size || !resolvedContentType) {
      return NextResponse.json({ error: 'Missing required fields: filename, size, contentType.' }, { status: 400 });
    }

    if (
      !ALLOWED_VIDEO_TYPES.has(resolvedContentType) &&
      !ALLOWED_DOCUMENT_TYPES.has(resolvedContentType) &&
      !ALLOWED_ZIP_TYPES.has(resolvedContentType)
    ) {
      return NextResponse.json({ error: 'Unsupported file format.' }, { status: 400 });
    }

    const { maxBytes, label } = getMaxUploadBytes(resolvedContentType);
    if (size > maxBytes) {
      return NextResponse.json({ error: `File is too large. Max size is ${label}.` }, { status: 400 });
    }

    // Generate unique filename
    const safeName = sanitizeFileName(filename || 'upload');
    const ext = path.extname(safeName) || '.bin';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const folderPath = path.posix.join('uploads', 'teacher-library', payload.sub);

    // Build direct-upload config for the browser
    const publicPrefix = (process.env.NEXT_PUBLIC_FILE_URL || '').replace(/"/g, '').replace(/\/$/, '');
    const uploadToken = (process.env.HOSTINGER_UPLOAD_TOKEN || '').replace(/"/g, '');

    if (!publicPrefix || !uploadToken) {
      return NextResponse.json({ error: 'Storage configuration missing.' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: `${publicPrefix}/upload.php`,
      token: uploadToken,
      fileName: uniqueFileName,
      folderPath,
      finalUrl: `${publicPrefix}/${folderPath}/${uniqueFileName}`,
      maxBytes,
      maxLabel: label,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
