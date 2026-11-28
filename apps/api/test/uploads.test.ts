import { describe, expect, it } from 'vitest';
import { Metadata, parseUploadId, UploadId } from '../src/lib/uploads';
import { HttpError } from '../src/lib/http';

const meta = { title: 'Song', durationMs: 1000, source: 'youtube' };

const INVALID_IDS = ['', 'with space', 'a/b', '../etc', ' padded ', 'ñ', 'x'.repeat(101)];
const VALID_IDS = ['a', 'job-1_B', 'x'.repeat(100)];

describe('upload id', () => {
  it('accepts letters, digits, dashes and underscores up to 100 characters', () => {
    for (const id of VALID_IDS) expect(parseUploadId(id)).toBe(id);
  });

  it('rejects anything else with a 400 validation_error', () => {
    for (const id of INVALID_IDS) {
      expect(UploadId.safeParse(id).success, JSON.stringify(id)).toBe(false);
      expect(() => parseUploadId(id)).toThrow(HttpError);
    }
    expect(() => parseUploadId(undefined)).toThrow(
      expect.objectContaining({ status: 400, code: 'validation_error' }),
    );
  });
});

describe('upload metadata', () => {
  it('keeps a valid uploadId', () => {
    expect(Metadata.parse({ ...meta, uploadId: 'job-1' }).uploadId).toBe('job-1');
  });

  it('defaults to null without uploadId (CLI and library copy)', () => {
    expect(Metadata.parse(meta).uploadId).toBeNull();
  });

  it('rejects an invalid uploadId', () => {
    for (const uploadId of [...INVALID_IDS, 7, null]) {
      const parsed = Metadata.safeParse({ ...meta, uploadId });
      expect(parsed.success, JSON.stringify(uploadId)).toBe(false);
    }
  });
});
