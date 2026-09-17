import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { VideoRecord, ResolutionVariant, VideoMetadata } from './video-types';
import { getSupabaseAdmin } from './db';
import { setJobProgress } from './video-job-store';

/**
 * Validates that ffmpeg and ffprobe can be safely executed on the system.
 */
export function assertFfmpegAvailable(): void {
  const probeCheck = spawnSync('ffprobe', ['-version'], { windowsHide: true });
  if (probeCheck.error) {
    const err = probeCheck.error as NodeJS.ErrnoException;
    if (err.code === 'UNKNOWN' || probeCheck.error.message.includes('UNKNOWN')) {
      throw new Error(
        'FFprobe execution was blocked by Windows Smart App Control (Error: spawn UNKNOWN / 0xC0E90002). Please disable Smart App Control in Windows Security to allow FFmpeg.'
      );
    }
    if (err.code === 'ENOENT') {
      throw new Error('FFprobe is not installed or not found on system PATH.');
    }
    throw new Error(`FFprobe check failed: ${probeCheck.error.message}`);
  }

  const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
  if (ffmpegCheck.error) {
    const err = ffmpegCheck.error as NodeJS.ErrnoException;
    if (err.code === 'UNKNOWN' || ffmpegCheck.error.message.includes('UNKNOWN')) {
      throw new Error(
        'FFmpeg execution was blocked by Windows Smart App Control (Error: spawn UNKNOWN / 0xC0E90002). Please disable Smart App Control in Windows Security to allow FFmpeg.'
      );
    }
    if (err.code === 'ENOENT') {
      throw new Error('FFmpeg is not installed or not found on system PATH.');
    }
    throw new Error(`FFmpeg check failed: ${ffmpegCheck.error.message}`);
  }
}

export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    try {
      assertFfmpegAvailable();
    } catch (e) {
      return reject(e);
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('No video stream found in uploaded file.'));
      }

      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
      const hasAudio = !!audioStream;

      const width = videoStream.width || 1280;
      const height = videoStream.height || 720;
      const duration = metadata.format.duration ? Math.round(metadata.format.duration) : 0;
      const codec = videoStream.codec_name || 'unknown';
      const size = metadata.format.size || 0;

      // Extract / calculate FPS
      let fps = 30;
      const rFrameRate = videoStream.r_frame_rate || videoStream.avg_frame_rate;
      if (rFrameRate) {
        const parts = rFrameRate.split('/');
        if (parts.length === 2 && Number(parts[1]) > 0) {
          fps = Math.round(Number(parts[0]) / Number(parts[1]));
        } else if (!isNaN(Number(rFrameRate))) {
          fps = Math.round(Number(rFrameRate));
        }
      }
      if (fps <= 0 || fps > 120) fps = 30;

      // Extract Audio Bitrate (kbps)
      let audioBitrate = 128;
      if (audioStream?.bit_rate) {
        audioBitrate = Math.round(Number(audioStream.bit_rate) / 1000);
      }

      // Extract / estimate Video Bitrate (kbps)
      let videoBitrate = 0;
      if (videoStream.bit_rate) {
        videoBitrate = Math.round(Number(videoStream.bit_rate) / 1000);
      } else if (metadata.format.bit_rate) {
        const totalBitrate = Math.round(Number(metadata.format.bit_rate) / 1000);
        videoBitrate = Math.max(100, totalBitrate - (hasAudio ? audioBitrate : 0));
      } else if (duration > 0 && size > 0) {
        const totalBitrate = Math.round((size * 8) / duration / 1000);
        videoBitrate = Math.max(100, totalBitrate - (hasAudio ? audioBitrate : 0));
      }

      resolve({
        width,
        height,
        duration,
        codec,
        size,
        fps,
        videoBitrate,
        audioBitrate,
        hasAudio,
      });
    });
  });
}

interface LadderPreset {
  name: string;
  height: number;
  width: number;
  crf: number;
  standardMaxrateKbps: number;
  weight2Rungs: number; // Used when ladder has 480p and 720p
  weight3Rungs: number; // Used when ladder has 480p, 720p, and 1080p
}

// Exact ladder preserving 480p, 720p, and 1080p (360p omitted as requested)
const LADDER_PRESETS: LadderPreset[] = [
  {
    name: '480p',
    height: 480,
    width: 854,
    crf: 24,
    standardMaxrateKbps: 1200,
    weight2Rungs: 0.38,
    weight3Rungs: 0.22,
  },
  {
    name: '720p',
    height: 720,
    width: 1280,
    crf: 21,
    standardMaxrateKbps: 2500,
    weight2Rungs: 0.62,
    weight3Rungs: 0.36,
  },
  {
    name: '1080p',
    height: 1080,
    width: 1920,
    crf: 19,
    standardMaxrateKbps: 5500,
    weight2Rungs: 0.0,
    weight3Rungs: 0.42,
  },
];

/**
 * Generates an adaptive ladder containing 480p, 720p, and (if source >= 1080) 1080p.
 * Budgets the VBV ceiling so the total combined output size remains strictly within 2.5x ~ 2.75x of the input file.
 */
export function getAvailableResolutions(
  sourceHeight: number,
  sourceWidth: number,
  sourceVideoBitrateKbps: number = 0,
  sourceAudioBitrateKbps: number = 0,
  sourceFileSize: number = 0,
  sourceDuration: number = 0
): ResolutionVariant[] {
  // Filter for 480p, 720p, and 1080p supported by source resolution
  const eligiblePresets = LADDER_PRESETS.filter((res) => res.height <= sourceHeight);

  // Fallback: If source is smaller than 480p, create 1 custom rendition matching source
  if (eligiblePresets.length === 0) {
    const customWidth = sourceWidth % 2 === 0 ? sourceWidth : sourceWidth - 1;
    const customHeight = sourceHeight % 2 === 0 ? sourceHeight : sourceHeight - 1;
    return [
      {
        name: `${customHeight}p`,
        height: customHeight,
        width: customWidth,
        crf: 24,
        maxrate: '500k',
        bufsize: '750k',
        bandwidth: 500000,
      },
    ];
  }

  // Calculate source total bitrate (in kbps)
  let sourceTotalBitrateKbps = sourceVideoBitrateKbps + sourceAudioBitrateKbps;
  if (sourceTotalBitrateKbps <= 0 && sourceFileSize > 0 && sourceDuration > 0) {
    sourceTotalBitrateKbps = Math.round((sourceFileSize * 8) / sourceDuration / 1000);
  }
  if (sourceTotalBitrateKbps <= 0) {
    sourceTotalBitrateKbps = 1500; // safe fallback
  }

  const targetMultiplier = 2.65;
  const totalBudgetKbps = Math.round(sourceTotalBitrateKbps * targetMultiplier);

  // Dedicated audio budget for the single shared audio track
  const audioBudgetKbps = sourceAudioBitrateKbps > 0
    ? Math.min(128, Math.max(64, sourceAudioBitrateKbps))
    : 96;

  // Video budget remaining to distribute across the video renditions
  const videoBudgetKbps = Math.max(150, totalBudgetKbps - audioBudgetKbps);
  const rungCount = eligiblePresets.length;

  return eligiblePresets.map((preset) => {
    let weight = 1.0;
    if (rungCount === 2) {
      weight = preset.weight2Rungs;
    } else if (rungCount >= 3) {
      weight = preset.weight3Rungs;
    }

    const targetKbps = Math.round(videoBudgetKbps * weight);
    const ceilingKbps = Math.min(preset.standardMaxrateKbps, Math.max(50, targetKbps));
    const bufsizeKbps = Math.round(ceilingKbps * 1.5);
    const bandwidth = ceilingKbps * 1000;

    return {
      name: preset.name,
      height: preset.height,
      width: preset.width,
      crf: preset.crf,
      maxrate: `${ceilingKbps}k`,
      bufsize: `${bufsizeKbps}k`,
      bandwidth,
    };
  });
}

/**
 * Transcodes audio once as a shared HLS audio rendition.
 * Eliminates duplicate audio tracks across video renditions.
 */
export function transcodeSharedAudio(
  inputPath: string,
  outputDir: string,
  audioBitrateKbps: number = 128
): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioDir = path.join(outputDir, 'audio');
    const playlistPath = path.join(audioDir, 'index.m3u8');
    const segmentPattern = path.join(audioDir, 'seg_%03d.ts');
    const safeAudioBitrate = Math.min(192, Math.max(64, audioBitrateKbps));

    fs.mkdir(audioDir, { recursive: true })
      .then(() => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vn', // Audio only
            '-c:a aac',
            `-b:a ${safeAudioBitrate}k`,
            '-ac 2',
            '-f hls',
            '-hls_time 4', // 4-second segments for VOD
            '-hls_playlist_type vod',
            `-hls_segment_filename ${segmentPattern}`,
          ])
          .output(playlistPath)
          .on('end', () => resolve())
          .on('error', (err, stdout, stderr) => {
            console.error('Audio transcode error:', err.message);
            console.error('ffmpeg stderr:', stderr);
            reject(err);
          })
          .run();
      })
      .catch(reject);
  });
}

/**
 * Transcodes video as a video-only HLS variant using resolution-specific Constrained CRF.
 * GOP cadence is aligned to the 4-second segment duration based on input FPS.
 */
export function transcodeVariant(
  inputPath: string,
  outputDir: string,
  variant: ResolutionVariant,
  fps: number = 30,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const variantDir = path.join(outputDir, variant.name);
    const playlistPath = path.join(variantDir, 'index.m3u8');
    const segmentPattern = path.join(variantDir, 'seg_%03d.ts');
    const gopSize = Math.max(24, Math.round(fps * 4)); // Keyframe cadence aligned to 4-second segment boundary

    fs.mkdir(variantDir, { recursive: true })
      .then(() => {
        ffmpeg(inputPath)
          .outputOptions([
            '-an', // Video only (audio is demuxed into a shared rendition)
            '-c:v libx264',
            '-preset veryfast',
            '-profile:v main',
            `-crf ${variant.crf}`,
            `-maxrate ${variant.maxrate}`,
            `-bufsize ${variant.bufsize}`,
            `-vf scale=w=-2:h=${variant.height}`,
            '-sc_threshold 0',
            `-g ${gopSize}`,
            `-keyint_min ${gopSize}`,
            '-f hls',
            '-hls_time 4', // 4-second segments for VOD
            '-hls_playlist_type vod',
            `-hls_segment_filename ${segmentPattern}`,
          ])
          .output(playlistPath)
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.min(100, Math.round(progress.percent)));
            }
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err, stdout, stderr) => {
            console.error(`Transcode error for ${variant.name}:`, err.message);
            console.error('ffmpeg stderr:', stderr);
            reject(err);
          })
          .run();
      })
      .catch(reject);
  });
}

/**
 * Generates an HLS master playlist with a shared #EXT-X-MEDIA audio group.
 */
export async function generateMasterPlaylist(
  outputDir: string,
  variants: ResolutionVariant[],
  hasAudio: boolean = true,
  audioBitrateKbps: number = 128
): Promise<string> {
  let content = '#EXTM3U\n#EXT-X-VERSION:4\n\n';

  if (hasAudio) {
    content += '# Audio Group\n';
    content += '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-group",NAME="Default Audio",DEFAULT=YES,AUTOSELECT=YES,URI="audio/index.m3u8"\n\n';
  }

  content += '# Video Streams\n';
  for (const variant of variants) {
    const totalBandwidth = variant.bandwidth + (hasAudio ? audioBitrateKbps * 1000 : 0);
    const audioAttr = hasAudio ? ',AUDIO="audio-group"' : '';
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${totalBandwidth},RESOLUTION=${variant.width}x${variant.height}${audioAttr},NAME="${variant.name}"\n`;
    content += `${variant.name}/index.m3u8\n\n`;
  }

  const masterPath = path.join(outputDir, 'master.m3u8');
  await fs.writeFile(masterPath, content, 'utf-8');
  return masterPath;
}

export function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        count: 1,
        timestamps: ['1'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '640x?',
      })
      .on('end', () => resolve())
      .on('error', () => {
        ffmpeg(inputPath)
          .screenshots({
            count: 1,
            timestamps: ['0'],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: '640x?',
          })
          .on('end', () => resolve())
          .on('error', reject);
      });
  });
}

/**
 * Full video transcoding pipeline:
 * 1. Probes input video for dimensions, fps, bitrate
 * 2. Transcodes shared audio into public/streams/[videoId]/audio/
 * 3. Transcodes 480p, 720p, 1080p into public/streams/[videoId]/[variant]/
 * 4. Writes public/streams/[videoId]/master.m3u8
 * 5. Generates public/streams/[videoId]/thumbnail.jpg
 * 6. Updates database node record in Supabase: switches url to /streams/[videoId]/master.m3u8
 * 7. Deletes original uploaded source.mp4 to reclaim disk space!
 */
export async function processVideoPipeline(
  videoId: string,
  nodeId: string,
  originalFilename: string,
  sourceMp4Path: string,
  onStatusUpdate?: (status: string, percent: number) => void
): Promise<VideoRecord> {
  assertFfmpegAvailable();

  const streamsDir = path.join(process.cwd(), 'public', 'streams', videoId);
  await fs.mkdir(streamsDir, { recursive: true });

  if (onStatusUpdate) onStatusUpdate('Analyzing video resolution and audio stream...', 5);
  const metadata = await probeVideo(sourceMp4Path);
  const originalResolution = `${metadata.width}x${metadata.height}`;

  const availableVariants = getAvailableResolutions(
    metadata.height,
    metadata.width,
    metadata.videoBitrate,
    metadata.audioBitrate,
    metadata.size,
    metadata.duration
  );
  const availableResolutions = availableVariants.map((v) => v.name);

  // 1. Encode shared audio once if audio stream is present
  if (metadata.hasAudio) {
    if (onStatusUpdate) onStatusUpdate('Encoding shared audio rendition...', 12);
    await transcodeSharedAudio(sourceMp4Path, streamsDir, metadata.audioBitrate);
  }

  // 2. Transcode each video resolution variant
  const totalVariants = availableVariants.length;
  for (let i = 0; i < totalVariants; i++) {
    const variant = availableVariants[i];
    const baseProgress = 18 + Math.round((i / totalVariants) * 72);
    if (onStatusUpdate) {
      onStatusUpdate(`Transcoding ${variant.name} (CRF ${variant.crf})...`, baseProgress);
    }

    await transcodeVariant(sourceMp4Path, streamsDir, variant, metadata.fps, (percent) => {
      const stepProgress = baseProgress + Math.round((percent / 100) * (72 / totalVariants));
      if (onStatusUpdate) {
        onStatusUpdate(`Transcoding ${variant.name} (${percent}%)...`, stepProgress);
      }
    });
  }

  // 3. Generate Master Playlist referencing shared audio and all video streams
  if (onStatusUpdate) onStatusUpdate('Generating master HLS manifest...', 92);
  await generateMasterPlaylist(
    streamsDir,
    availableVariants,
    metadata.hasAudio,
    metadata.audioBitrate
  );

  // 4. Generate Thumbnail poster
  const thumbnailPath = path.join(streamsDir, 'thumbnail.jpg');
  try {
    await generateThumbnail(sourceMp4Path, thumbnailPath);
  } catch (err) {
    console.warn('Could not generate thumbnail, continuing without it:', err);
  }

  const masterPlaylistUrl = `/streams/${videoId}/master.m3u8`;
  const thumbnailUrl = `/streams/${videoId}/thumbnail.jpg`;

  // 5. Update Supabase database record
  try {
    const supabase = getSupabaseAdmin();
    const formattedDuration = metadata.duration
      ? `${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, '0')}`
      : null;

    const { data: existingNode } = await supabase
      .from('VideoLibraryNode')
      .select('attachments')
      .eq('id', nodeId)
      .maybeSingle();

    const existingAtts = (existingNode?.attachments as Record<string, any>) || {};

    await supabase
      .from('VideoLibraryNode')
      .update({
        url: masterPlaylistUrl,
        duration: formattedDuration,
        attachments: {
          ...existingAtts,
          transcodeStatus: 'ready',
          availableResolutions,
          originalResolution,
          masterPlaylistUrl,
          thumbnailUrl,
        },
        updatedAt: new Date().toISOString(),
      } as any)
      .eq('id', nodeId);
  } catch (dbErr) {
    console.error(`Failed to update VideoLibraryNode in Supabase for ${nodeId}:`, dbErr);
  }

  // 6. Delete original MP4 file to reclaim disk space!
  try {
    await fs.unlink(sourceMp4Path);
    console.log(`Successfully removed original source MP4 to save disk space: ${sourceMp4Path}`);
  } catch (unlinkErr) {
    console.warn(`Could not delete original MP4 file ${sourceMp4Path}:`, unlinkErr);
  }

  if (onStatusUpdate) onStatusUpdate('Ready', 100);

  const videoRecord: VideoRecord = {
    id: videoId,
    title: originalFilename.replace(/\.mp4$/i, ''),
    originalResolution,
    availableResolutions,
    masterPlaylistUrl,
    createdAt: new Date().toISOString(),
    duration: metadata.duration,
    size: metadata.size,
    thumbnailUrl,
  };

  return videoRecord;
}
