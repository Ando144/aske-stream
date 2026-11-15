import { describe, expect, it } from 'vitest';
import { normalizeServerUrl } from '../src/lib/url';

describe('normalizeServerUrl', () => {
  it('accepts what people actually type or paste', () => {
    expect(normalizeServerUrl('aske-stream.ando.workers.dev')).toBe(
      'https://aske-stream.ando.workers.dev',
    );
    expect(normalizeServerUrl('  https://Aske-Stream.Ando.workers.dev/settings?x=1 ')).toBe(
      'https://aske-stream.ando.workers.dev',
    );
    expect(normalizeServerUrl('HTTPS://aske.example.com/')).toBe('https://aske.example.com');
    expect(normalizeServerUrl('http://localhost:8787')).toBe('http://localhost:8787');
  });

  it('rejects things that are not web addresses', () => {
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl('my server')).toBeNull();
    expect(normalizeServerUrl('aske')).toBeNull();
  });
});
