import { describe, expect, it } from 'vitest';
import { HUB_LIMITS } from '@aske/shared/hub';
import { parseClientMessage } from '../src/jam/protocol';

const song = { videoId: 'dQw4w9WgXcQ', title: 'Song', artist: 'Band' };

describe('parseClientMessage', () => {
  it('rejects broken JSON', () => {
    expect(parseClientMessage('{nope')).toBeNull();
  });
  it('rejects unknown types', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'hack' }))).toBeNull();
  });
  it('rejects oversized messages', () => {
    const big = JSON.stringify({ type: 'vote', itemId: 'x'.repeat(HUB_LIMITS.wsMessageMaxBytes) });
    expect(parseClientMessage(big)).toBeNull();
  });
  it('accepts a valid add', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'add', song }))).toEqual({
      type: 'add',
      song,
    });
  });
  it('accepts hello and finish', () => {
    const hello = { type: 'hello', memberId: 'm1', nickname: 'Ana' };
    expect(parseClientMessage(JSON.stringify(hello))).toEqual(hello);
    expect(parseClientMessage('{"type":"finish"}')).toEqual({ type: 'finish' });
  });
});
