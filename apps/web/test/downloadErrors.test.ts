import { describe, expect, it, vi } from 'vitest';

class FakeDriveAuthRequired extends Error {}

vi.mock('../src/i18n', () => ({ t: (key: string) => key }));
vi.mock('../src/storage/drive/auth', () => ({ DriveAuthRequired: FakeDriveAuthRequired }));

const { friendlyError, localErrorText, saveErrorText } = await import('../src/downloads/errors');

describe('friendlyError', () => {
  it.each([
    ['Storage is full', 'dl.err.cloudFull'],
    ['storage_full', 'dl.err.cloudFull'],
    ['drive_full', 'dl.err.driveFull'],
    ['drive_auth', 'dl.err.driveAuth'],
    ['Quota exceeded', 'dl.err.phoneFull'],
    ['No space left on device', 'dl.err.phoneFull'],
    ['ENOSPC', 'dl.err.phoneFull'],
    ['Sign in to confirm you are not a bot', 'dl.err.bot'],
    ['Private video', 'dl.err.unavailable'],
    ['Video unavailable', 'dl.err.unavailable'],
    ['This video was removed', 'dl.err.unavailable'],
    ['Sign in to confirm your age', 'dl.err.age'],
    ['Blocked for copyright', 'dl.err.blocked'],
    ['Not available in your country', 'dl.err.blocked'],
    ['network', 'dl.err.network'],
    ['Read timed out', 'dl.err.network'],
    ['Unable to download webpage', 'dl.err.network'],
    ['Connection reset', 'dl.err.network'],
    ['The file is too large', 'dl.err.tooBig'],
    ['file too big', 'dl.err.tooBig'],
    ['upload_timeout', 'dl.err.saveTooSlow'],
    ['local_failed', 'dl.err.localFailed'],
    ['something else entirely', 'dl.err.generic'],
  ])('maps "%s" to %s', (raw, key) => {
    expect(friendlyError(raw)).toBe(key);
  });
});

describe('saveErrorText', () => {
  it('keeps the Drive full code', () => {
    expect(saveErrorText(Object.assign(new Error('x'), { code: 'drive_full' }))).toBe('drive_full');
  });

  it('turns a Drive sign-in error into drive_auth', () => {
    expect(saveErrorText(new FakeDriveAuthRequired('x'))).toBe('drive_auth');
  });

  it('keeps the upload timeout code', () => {
    expect(saveErrorText(Object.assign(new Error('x'), { code: 'upload_timeout' }))).toBe(
      'upload_timeout',
    );
  });

  it('uses the message of any other error, or the value itself', () => {
    expect(saveErrorText(new Error('boom'))).toBe('boom');
    expect(saveErrorText('plain')).toBe('plain');
  });
});

describe('localErrorText', () => {
  it('recognises a full phone', () => {
    const quota = Object.assign(new Error('x'), { name: 'QuotaExceededError' });
    expect(friendlyError(localErrorText(quota))).toBe('dl.err.phoneFull');
  });

  it('explains any other failure as a phone save problem', () => {
    expect(friendlyError(localErrorText(new TypeError('Failed to fetch')))).toBe(
      'dl.err.localFailed',
    );
  });
});
