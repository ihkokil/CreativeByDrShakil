import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { requireTeacherPayload } from '@/lib/route-auth';
import { getSupabaseAdmin } from '@/lib/db';
import { processVideoPipeline, assertFfmpegAvailable } from '@/lib/video-transcoder';
import { setJobProgress } from '@/lib/video-job-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const payload = await requireTeacherPayload(req);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher access required.' }, { status: 401 });
    }

    try {
      assertFfmpegAvailable();
    } catch (err: unknown) {
      const error = err as Error;
      return NextResponse.json(
        { error: `Transcoding prerequisite error: ${error.message}` },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const title = (formData.get('title') as string | null)?.trim() || '';
    const parentId = (formData.get('parentId') as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided.' }, { status: 400 });
    }

    const targetNodeId = (formData.get('nodeId') as string | null)?.trim() || crypto.randomUUID();
    const videoId = targetNodeId;
    const streamsDir = path.join(process.cwd(), 'public', 'streams', videoId);
    await fs.mkdir(streamsDir, { recursive: true });

    const sourceMp4Path = path.join(streamsDir, 'source.mp4');

    // Stream file contents directly to disk
    const fileStream = file.stream();
    const nodeReadable = Readable.fromWeb(fileStream as unknown as import('stream/web').ReadableStream);
    const writeStream = createWriteStream(sourceMp4Path);
    await pipeline(nodeReadable, writeStream);

    const supabase = getSupabaseAdmin();
    const initialUrl = `/streams/${videoId}/source.mp4`;
    const resolvedTitle = title || file.name.replace(/\.[^/.]+$/, '');
    const nowStr = new Date().toISOString();

    const isEdit = Boolean((formData.get('nodeId') as string | null)?.trim());
    let nodeRecord: any = null;

    if (isEdit) {
      const { data: existing } = await supabase
        .from('VideoLibraryNode')
        .select('*')
        .eq('id', targetNodeId)
        .maybeSingle();

      const existingAtts = (existing?.attachments as Record<string, any>) || {};
      const updateData = {
        url: initialUrl,
        type: 'self-hosted',
        ...(title ? { title: resolvedTitle } : {}),
        attachments: {
          ...existingAtts,
          transcodeStatus: 'transcoding',
          videoId,
          originalFilename: file.name,
          fileSize: file.size,
        },
        updatedAt: nowStr,
      };

      await supabase.from('VideoLibraryNode').update(updateData as any).eq('id', targetNodeId);
      nodeRecord = { ...existing, ...updateData };
    } else {
      let query = supabase.from('VideoLibraryNode').select('sortOrder').order('sortOrder', { ascending: false }).limit(1);
      if (parentId) {
        query = query.eq('parentId', parentId);
      } else {
        query = query.is('parentId', null);
      }
      const { data: orderRes } = await query.maybeSingle();
      const nextOrder = ((orderRes as any)?.sortOrder ?? -1) + 1;

      const insertValues = {
        id: targetNodeId,
        title: resolvedTitle,
        type: 'self-hosted',
        url: initialUrl,
        parentId,
        sortOrder: nextOrder,
        attachments: {
          transcodeStatus: 'transcoding',
          videoId,
          originalFilename: file.name,
          fileSize: file.size,
        },
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      const { error: insertError } = await supabase.from('VideoLibraryNode').insert(insertValues as any);
      if (insertError) {
        throw insertError;
      }
      nodeRecord = insertValues;
    }

    // Initialize progress tracking
    setJobProgress(videoId, {
      stage: 'analyzing',
      progress: 5,
      message: 'Video saved! Transcoding HLS in background...',
      videoId,
    });

    // Start background HLS transcoding
    (async () => {
      try {
        await processVideoPipeline(
          videoId,
          targetNodeId,
          file.name,
          sourceMp4Path,
          (status, percent) => {
            const stage = percent >= 95 ? 'ready' : percent > 15 ? 'transcoding' : 'analyzing';
            setJobProgress(videoId, {
              stage,
              progress: percent,
              message: status,
              videoId,
            });
          }
        );

        setJobProgress(videoId, {
          stage: 'ready',
          progress: 100,
          message: 'HLS stream ready',
          videoId,
        });
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`Background transcode failed for video ${videoId}:`, error);
        setJobProgress(videoId, {
          stage: 'error',
          progress: 0,
          message: 'Transcoding failed',
          videoId,
          error: error.message || 'Unknown transcoding error occurred.',
        });
      }
    })();

    return NextResponse.json({
      success: true,
      videoId,
      nodeId: targetNodeId,
      url: initialUrl,
      node: nodeRecord,
      message: 'Upload successful. Serving MP4 immediately, HLS transcoding running in background.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error handling video upload:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process uploaded video.' },
      { status: 500 }
    );
  }
}
