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
  it('keeps only the known hello features', () => {
    const hello = { type: 'hello', memberId: 'm1', nickname: 'Ana' };
    const raw = JSON.stringify({ ...hello, features: ['remoteSkip', 'teleport'] });
    expect(parseClientMessage(raw)).toEqual({ ...hello, features: ['remoteSkip'] });
  });
  it('rejects too many or overlong hello features', () => {
    const hello = { type: 'hello', memberId: 'm1', nickname: 'Ana' };
    for (const features of [Array(9).fill('remoteSkip'), ['x'.repeat(33)], 'remoteSkip']) {
      expect(parseClientMessage(JSON.stringify({ ...hello, features }))).toBeNull();
    }
  });
  it('accepts skip only with an item id', () => {
    const skip = { type: 'skip', itemId: 'one' };
    expect(parseClientMessage(JSON.stringify(skip))).toEqual(skip);
    expect(parseClientMessage('{"type":"skip"}')).toBeNull();
    expect(parseClientMessage('{"type":"skip","itemId":""}')).toBeNull();
  });
});
