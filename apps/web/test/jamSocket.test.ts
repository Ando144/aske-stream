import type { JamClientMessage } from '@aske/shared/hub';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JamSocket, type SocketLike } from '../src/hub/jamSocket';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const hello: JamClientMessage = { type: 'hello', memberId: 'm', nickname: 'n' };

describe('JamSocket', () => {
  let sockets: FakeSocket[];
  let js: JamSocket;
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    js = new JamSocket(() => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    });
  });
  afterEach(() => vi.useRealTimers());

  it('sends hello when it opens', () => {
    js.connect('wss://x', hello);
    sockets[0]!.open();
    expect(sockets[0]!.sent).toEqual([JSON.stringify(hello)]);
  });

  it('reconnects after an abnormal close, with backoff', () => {
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.drop(1006);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1]!.drop(1006);
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('does not reconnect with code 4000', () => {
    const statuses: string[] = [];
    js.onStatus = (s) => statuses.push(s);
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.drop(4000);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe('closed');
  });

  it('reports replaced and never reconnects with code 4001', () => {
    const statuses: string[] = [];
    js.onStatus = (s) => statuses.push(s);
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.drop(4001);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)).toBe('replaced');
  });

  it('gives up after 5 minutes without connecting and reports gaveUp', () => {
    const statuses: string[] = [];
    js.onStatus = (s) => statuses.push(s);
    js.connect('wss://x', hello);
    for (let i = 0; i < 100 && statuses.at(-1) !== 'gaveUp'; i++) {
      sockets.at(-1)!.drop(1006);
      vi.advanceTimersByTime(30_000);
    }
    expect(statuses.at(-1)).toBe('gaveUp');
    const count = sockets.length;
    vi.advanceTimersByTime(10 * 60_000);
    expect(sockets).toHaveLength(count);
    expect(count).toBeLessThan(20);
  });

  it('restarts the retry window after a successful connection', () => {
    const statuses: string[] = [];
    js.onStatus = (s) => statuses.push(s);
    js.connect('wss://x', hello);
    sockets[0]!.drop(1006);
    vi.advanceTimersByTime(4 * 60_000);
    sockets.at(-1)!.open();
    vi.advanceTimersByTime(4 * 60_000);
    sockets.at(-1)!.drop(1006);
    expect(statuses.at(-1)).toBe('reconnecting');
  });

  it('can connect again by hand after giving up', () => {
    js.connect('wss://x', hello);
    for (let i = 0; i < 30; i++) {
      sockets.at(-1)!.drop(1006);
      vi.advanceTimersByTime(30_000);
    }
    const count = sockets.length;
    js.connect('wss://x', hello);
    expect(sockets).toHaveLength(count + 1);
  });

  it('does not reconnect with code 1013 (jam full)', () => {
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.drop(1013);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('does not reconnect after an ended message', () => {
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.onmessage?.({ data: JSON.stringify({ type: 'ended', reason: 'host' }) });
    sockets[0]!.drop(1000);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('queues messages while offline and flushes them after reconnecting', () => {
    js.connect('wss://x', hello);
    sockets[0]!.open();
    sockets[0]!.drop(1006);
    js.send({ type: 'vote', itemId: 'a' });
    vi.advanceTimersByTime(1000);
    sockets[1]!.open();
    expect(sockets[1]!.sent.map((s) => JSON.parse(s).type)).toEqual(['hello', 'vote']);
  });

  it('keeps at most 20 queued messages', () => {
    js.connect('wss://x', hello);
    for (let i = 0; i < 25; i++) js.send({ type: 'vote', itemId: String(i) });
    sockets[0]!.open();
    expect(sockets[0]!.sent).toHaveLength(21);
  });
});
