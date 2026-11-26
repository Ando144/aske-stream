import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUB_LIMITS } from '@aske/shared/hub';
import { FakeCtx, FakeSocket, installWebSocketPair } from './fakeRoom';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));

const { JamRoom } = await import('../src/jam/room');
const { sha256Hex } = await import('../src/lib/crypto');

const NOW = 1_700_000_000_000;
const song = { videoId: 'dQw4w9WgXcQ', title: 'Song', artist: 'Artist' };

function makeRoom() {
  const ctx = new FakeCtx();
  const room = new JamRoom(ctx as never, {} as never);
  return { ctx, room };
}

async function liveRoom() {
  const made = makeRoom();
  const hostKey = 'secret-host-key';
  await made.room.init({
    code: 'ABC234',
    hostName: 'Host',
    hostKeyHash: await sha256Hex(hostKey),
    expiresAt: NOW + HUB_LIMITS.jamTtlMs,
  });
  return { ...made, hostKey };
}

function join(ctx: FakeCtx, room: InstanceType<typeof JamRoom>) {
  const ws = new FakeSocket();
  ctx.sockets.push(ws);
  const say = (msg: unknown) => room.webSocketMessage(ws as never, JSON.stringify(msg));
  return { ws, say };
}

describe('JamRoom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sha256Hex matches the known digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('init stores the Jam, sets the expiry alarm and refuses a second init', async () => {
    const { ctx, room } = makeRoom();
    const p = { code: 'ABC234', hostName: 'H', hostKeyHash: 'x', expiresAt: NOW + 1000 };
    expect(await room.init(p)).toBe(true);
    expect(ctx.alarm).toBe(NOW + 1000);
    expect(await room.init({ ...p, hostName: 'Other' })).toBe(false);
    expect((await room.info())?.hostName).toBe('H');
  });

  it('init succeeds again once the previous Jam has expired', async () => {
    const { room } = makeRoom();
    const p = { code: 'ABC234', hostName: 'H', hostKeyHash: 'x', expiresAt: NOW + 1000 };
    await room.init(p);
    vi.setSystemTime(NOW + 1000);
    expect(await room.init({ ...p, expiresAt: NOW + 5000 })).toBe(true);
  });

  it('info returns null for an empty room and counts only members who said hello', async () => {
    const { ctx, room } = makeRoom();
    expect(await room.info()).toBeNull();
    const { room: live, ctx: liveCtx } = await liveRoom();
    const a = join(liveCtx, live);
    join(liveCtx, live); // connected but silent
    await a.say({ type: 'hello', memberId: 'm1', nickname: 'Ann' });
    expect(await live.info()).toMatchObject({ code: 'ABC234', hostName: 'Host', members: 1 });
    expect(ctx.sockets).toHaveLength(0);
  });

  it('info of an expired Jam is null and wipes the storage', async () => {
    const { ctx, room } = await liveRoom();
    vi.setSystemTime(NOW + HUB_LIMITS.jamTtlMs);
    expect(await room.info()).toBeNull();
    expect(ctx.store.size).toBe(0);
  });

  it('alarm ends the Jam, notifying and closing every socket', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    await room.alarm();
    expect(a.ws.last()).toEqual({ type: 'ended', reason: 'expired' });
    expect(a.ws.closed?.code).toBe(4000);
    expect(ctx.store.size).toBe(0);
  });

  it('hello with the right hostKey makes a host; a wrong or missing key does not', async () => {
    const { ctx, room, hostKey } = await liveRoom();
    const host = join(ctx, room);
    const guest = join(ctx, room);
    const thief = join(ctx, room);
    await host.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey });
    await guest.say({ type: 'hello', memberId: 'g', nickname: 'Guest' });
    await thief.say({ type: 'hello', memberId: 't', nickname: 'Thief', hostKey: 'nope' });
    expect(host.ws.deserializeAttachment()).toMatchObject({ isHost: true });
    expect(guest.ws.deserializeAttachment()).toMatchObject({ isHost: false });
    expect(thief.ws.deserializeAttachment()).toMatchObject({ isHost: false });
  });

  it('hello normalizes the nickname and rejects an empty or overlong one', async () => {
    const { ctx, room } = await liveRoom();
    const ok = join(ctx, room);
    await ok.say({ type: 'hello', memberId: 'a', nickname: '  Ann   Lee ' });
    expect(ok.ws.deserializeAttachment()).toMatchObject({ nickname: 'Ann Lee' });
    for (const nickname of ['   ', 'x'.repeat(HUB_LIMITS.nicknameMax + 1)]) {
      const bad = join(ctx, room);
      await bad.say({ type: 'hello', memberId: 'b', nickname });
      expect(bad.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
      expect(bad.ws.deserializeAttachment()).toBeNull();
    }
  });

  it('a second hello on the same socket cannot upgrade to host', async () => {
    const { ctx, room, hostKey } = await liveRoom();
    const a = join(ctx, room);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann', hostKey });
    expect(a.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
    expect(a.ws.deserializeAttachment()).toMatchObject({ isHost: false });
  });

  it('a hello reusing a connected memberId replaces the old socket (reconnect)', async () => {
    const { ctx, room, hostKey } = await liveRoom();
    const old = join(ctx, room);
    const fresh = join(ctx, room);
    await old.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey });
    await fresh.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey });
    expect(old.ws.closed?.code).toBe(4001);
    expect(fresh.ws.last()).toMatchObject({ type: 'state', you: { memberId: 'h', isHost: true } });
    expect(fresh.ws.closed).toBeNull();
  });

  it('invalid JSON, binary frames and actions before hello are rejected', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    await room.webSocketMessage(a.ws as never, 'not json');
    expect(a.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
    await room.webSocketMessage(a.ws as never, new ArrayBuffer(4));
    expect(a.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
    await a.say({ type: 'add', song });
    expect(a.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
  });

  it('a message after expiry ends the connection with "ended"', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    vi.setSystemTime(NOW + HUB_LIMITS.jamTtlMs + 1);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    expect(a.ws.sent.some((m) => m.type === 'ended')).toBe(true);
    expect(a.ws.closed?.code).toBe(4000);
  });

  it('add broadcasts a personalised state to every member', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    const b = join(ctx, room);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    await b.say({ type: 'hello', memberId: 'b', nickname: 'Bob' });
    await a.say({ type: 'add', song });
    const stateA = a.ws.last() as { jam: { queue: Array<{ mine: boolean }> } };
    const stateB = b.ws.last() as { jam: { queue: Array<{ mine: boolean }> } };
    expect(stateA.jam.queue).toHaveLength(1);
    expect(stateA.jam.queue[0]!.mine).toBe(true);
    expect(stateB.jam.queue[0]!.mine).toBe(false);
  });

  it('add with an invalid song returns invalid_request and keeps the queue empty', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    await a.say({ type: 'add', song: { ...song, videoId: 'bad' } });
    expect(a.ws.last()).toEqual({ type: 'error', code: 'invalid_request' });
  });

  it('a guest cannot start or end the Jam; the host can end it', async () => {
    const { ctx, room, hostKey } = await liveRoom();
    const host = join(ctx, room);
    const guest = join(ctx, room);
    await host.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey });
    await guest.say({ type: 'hello', memberId: 'g', nickname: 'Guest' });
    await guest.say({ type: 'end' });
    expect(guest.ws.last()).toEqual({ type: 'error', code: 'not_host' });
    expect(ctx.store.size).toBe(1);
    await host.say({ type: 'end' });
    expect(guest.ws.last()).toEqual({ type: 'ended', reason: 'host' });
    expect(host.ws.closed?.code).toBe(4000);
    expect(ctx.store.size).toBe(0);
  });

  it('closing a socket rebroadcasts the member list', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    const b = join(ctx, room);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    await b.say({ type: 'hello', memberId: 'b', nickname: 'Bob' });
    ctx.sockets = ctx.sockets.filter((s) => s !== b.ws);
    await room.webSocketClose(b.ws as never);
    const last = a.ws.last() as { jam: { members: unknown[] } };
    expect(last.jam.members).toHaveLength(1);
  });

  it('a socket that throws on send does not stop the others from getting the state', async () => {
    const { ctx, room } = await liveRoom();
    const a = join(ctx, room);
    const b = join(ctx, room);
    const c = join(ctx, room);
    await a.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
    await b.say({ type: 'hello', memberId: 'b', nickname: 'Bob' });
    await c.say({ type: 'hello', memberId: 'c', nickname: 'Cy' });
    b.ws.send = () => {
      throw new Error('broken socket');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    ctx.sockets = ctx.sockets.filter((s) => s !== c.ws);
    await expect(room.webSocketClose(c.ws as never)).resolves.toBeUndefined();
    const last = a.ws.last() as { jam: { members: unknown[] } };
    expect(last.jam.members).toHaveLength(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('skip', () => {
    type State = {
      type: string;
      jam: {
        canSkip: boolean;
        skipRequested: string | null;
        nowPlaying: { id: string } | null;
        queue: Array<{ id: string }>;
        members: object[];
      };
      you: Record<string, unknown>;
    };
    const stateOf = (ws: FakeSocket) => ws.last() as unknown as State;

    async function playingRoom(features: string[] = ['remoteSkip']) {
      const { ctx, room, hostKey } = await liveRoom();
      const host = join(ctx, room);
      const ann = join(ctx, room);
      const bob = join(ctx, room);
      await host.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey, features });
      await ann.say({ type: 'hello', memberId: 'a', nickname: 'Ann' });
      await bob.say({ type: 'hello', memberId: 'b', nickname: 'Bob' });
      await ann.say({ type: 'add', song });
      await ann.say({ type: 'add', song: { ...song, videoId: 'aaaaaaaaaaa' } });
      const [first, second] = stateOf(ann.ws).jam.queue.map((item) => item.id) as [string, string];
      await host.say({ type: 'start', itemId: first });
      return { ctx, room, host, ann, bob, first, second };
    }

    it("a guest's skip is stored and broadcast without changing what plays", async () => {
      const { ctx, host, ann, bob, first } = await playingRoom();
      await ann.say({ type: 'skip', itemId: first });
      for (const member of [host, ann, bob]) {
        expect(stateOf(member.ws).jam).toMatchObject({
          canSkip: true,
          skipRequested: first,
          nowPlaying: { id: first },
        });
      }
      expect(ctx.store.get('jam')).toMatchObject({ skipRequested: first });
      expect(ann.ws.deserializeAttachment()).toMatchObject({ lastSkipAt: NOW });
    });

    it('ignores a repeated request and a song that is not playing', async () => {
      const { host, ann, bob, first, second } = await playingRoom();
      await ann.say({ type: 'skip', itemId: second });
      expect(ann.ws.deserializeAttachment()).not.toHaveProperty('lastSkipAt');
      await ann.say({ type: 'skip', itemId: first });
      const sent = [host.ws.sent.length, bob.ws.sent.length];
      await bob.say({ type: 'skip', itemId: first });
      expect([host.ws.sent.length, bob.ws.sent.length]).toEqual(sent);
      expect(bob.ws.deserializeAttachment()).not.toHaveProperty('lastSkipAt');
    });

    it('limits each person to one skip every 2 s, without limiting the others', async () => {
      const { host, ann, bob, first, second } = await playingRoom();
      await ann.say({ type: 'skip', itemId: first });
      await host.say({ type: 'start', itemId: second });
      expect(stateOf(ann.ws).jam.skipRequested).toBeNull();
      vi.setSystemTime(NOW + HUB_LIMITS.jamSkipEveryMs - 1);
      const sent = host.ws.sent.length;
      await ann.say({ type: 'skip', itemId: second });
      expect(host.ws.sent).toHaveLength(sent);
      await bob.say({ type: 'skip', itemId: second });
      expect(stateOf(host.ws).jam.skipRequested).toBe(second);
    });

    it('lets the same person skip again after 2 s', async () => {
      const { host, ann, first, second } = await playingRoom();
      await ann.say({ type: 'skip', itemId: first });
      await host.say({ type: 'start', itemId: second });
      vi.setSystemTime(NOW + HUB_LIMITS.jamSkipEveryMs);
      await ann.say({ type: 'skip', itemId: second });
      expect(stateOf(host.ws).jam.skipRequested).toBe(second);
    });

    it('answers host_outdated when the host did not announce remoteSkip', async () => {
      const { ann, first } = await playingRoom([]);
      expect(stateOf(ann.ws).jam.canSkip).toBe(false);
      await ann.say({ type: 'skip', itemId: first });
      expect(ann.ws.last()).toEqual({ type: 'error', code: 'host_outdated' });
    });

    it('a v0.9.3 hello without features works and counts as an outdated host', async () => {
      const { ctx, room, hostKey } = await liveRoom();
      const host = join(ctx, room);
      await host.say({ type: 'hello', memberId: 'h', nickname: 'Host', hostKey });
      expect(stateOf(host.ws)).toMatchObject({ type: 'state', jam: { canSkip: false } });
      await host.say({ type: 'skip', itemId: 'x' });
      expect(host.ws.last()).toEqual({ type: 'error', code: 'host_outdated' });
    });

    it('answers host_away when no host is connected', async () => {
      const { ctx, room, host, ann, first } = await playingRoom();
      ctx.sockets = ctx.sockets.filter((s) => s !== host.ws);
      await room.webSocketClose(host.ws as never);
      expect(stateOf(ann.ws).jam.canSkip).toBe(false);
      await ann.say({ type: 'skip', itemId: first });
      expect(ann.ws.last()).toEqual({ type: 'error', code: 'host_away' });
    });

    it('never sends the internal attachment fields to clients', async () => {
      const { host, ann, first } = await playingRoom();
      await ann.say({ type: 'skip', itemId: first });
      expect(stateOf(ann.ws).you).toEqual({ memberId: 'a', nickname: 'Ann', isHost: false });
      expect(stateOf(host.ws).you).toEqual({ memberId: 'h', nickname: 'Host', isHost: true });
      for (const member of stateOf(ann.ws).jam.members) {
        expect(Object.keys(member).sort()).toEqual(['isHost', 'nickname']);
      }
    });
  });

  describe('fetch', () => {
    it('answers 426 without the WebSocket upgrade header', async () => {
      const { room } = await liveRoom();
      expect((await room.fetch(new Request('http://x/'))).status).toBe(426);
    });

    it('answers 404 when the Jam does not exist', async () => {
      const { room } = makeRoom();
      const res = await room.fetch(new Request('http://x/', { headers: { Upgrade: 'websocket' } }));
      expect(res.status).toBe(404);
    });

    it('closes the socket with jam_full beyond the member limit', async () => {
      const { ctx, room } = await liveRoom();
      const created: FakeSocket[] = [];
      installWebSocketPair(created);
      for (let i = 0; i < HUB_LIMITS.jamMaxMembers; i++) ctx.sockets.push(new FakeSocket());
      // Node's Response rejects status 101, so the call may throw after the socket was handled.
      await room
        .fetch(new Request('http://x/', { headers: { Upgrade: 'websocket' } }))
        .catch(() => undefined);
      const server = ctx.sockets[ctx.sockets.length - 1]!;
      expect(server.last()).toEqual({ type: 'error', code: 'jam_full' });
      expect(server.closed?.code).toBe(1013);
    });

    it('accepts the 30th connection without closing it', async () => {
      const { ctx, room } = await liveRoom();
      installWebSocketPair([]);
      for (let i = 0; i < HUB_LIMITS.jamMaxMembers - 1; i++) ctx.sockets.push(new FakeSocket());
      await room
        .fetch(new Request('http://x/', { headers: { Upgrade: 'websocket' } }))
        .catch(() => undefined);
      expect(ctx.sockets).toHaveLength(HUB_LIMITS.jamMaxMembers);
      expect(ctx.sockets[ctx.sockets.length - 1]!.closed).toBeNull();
    });
  });
});
