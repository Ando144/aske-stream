import { describe, expect, it, vi } from 'vitest';
import type { DownloadJob, JobStatus } from '../src/downloads/types';

vi.mock('../src/downloads/imports', () => ({ findInLibrary: () => undefined }));

const { sharedNoticeKey } = await import('../src/share/sharedNotice');

const job = (status: JobStatus, videoId = 'vid') => ({ videoId, status }) as DownloadJob;

describe('the notice after sharing a video', () => {
  it('says it was added when it was queued', () => {
    expect(sharedNoticeKey(1, 'vid', [job('queued')])).toBe('shareIn.added');
  });

  it.each(['queued', 'downloading', 'downloaded', 'saving'] as const)(
    'says it is already on its way when its job is %s',
    (status) => {
      expect(sharedNoticeKey(0, 'vid', [job(status)])).toBe('shareIn.alreadyQueued');
    },
  );

  it('says it was already yours when no active job has it', () => {
    const jobs = [job('skipped'), job('queued', 'other')];
    expect(sharedNoticeKey(0, 'vid', jobs)).toBe('shareIn.alreadyHad');
  });
});
