import { TranscodeProgress, VideoRecord } from './video-types';

// In-memory progress tracking for active transcoding jobs
const jobs = new Map<string, TranscodeProgress & { record?: VideoRecord }>();

export function setJobProgress(videoId: string, progress: TranscodeProgress & { record?: VideoRecord }) {
  jobs.set(videoId, progress);
}

export function getJobProgress(videoId: string) {
  return jobs.get(videoId) || null;
}

export function deleteJob(videoId: string) {
  jobs.delete(videoId);
}
