import { DurableObject } from 'cloudflare:workers';
import {
  HUB_LIMITS,
  normalizeNickname,
  type HubErrorCode,
  type JamClientMessage,
  type JamInfo,
  type JamMember,
  type JamServerMessage,
} from '@aske/shared/hub';
import type { HubEnv } from '../env';
import { safeEqual, sha256Hex } from '../lib/crypto';
import { parseClientMessage } from './protocol';
import { applyAction, toSnapshot, type JamData } from './state';

const STORAGE_KEY = 'jam';
const CLOSE_ENDED = 4000;
const CLOSE_FULL = 1013;
const CLOSE_REPLACED = 4001;

function send(ws: WebSocket, msg: JamServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function memberOf(ws: WebSocket): JamMember | null {
  return (ws.deserializeAttachment() as JamMember | null) ?? null;
}

export class JamRoom extends DurableObject<HubEnv> {
  /** Returns false when a live Jam already uses this room. */
  async init(p: {
    code: string;
    hostName: string;
    hostKeyHash: string;
    expiresAt: number;
  }): Promise<boolean> {
    if (await this.load()) return false;
    const data: JamData = { ...p, nowPlaying: null, queue: [] };
    await this.ctx.storage.put(STORAGE_KEY, data);
    await this.ctx.storage.setAlarm(p.expiresAt);
    return true;
  }

  async info(): Promise<JamInfo | null> {
    const data = await this.load();
    if (!data) return null;
    return {
      code: data.code,
      hostName: data.hostName,
      expiresAt: data.expiresAt,
      members: this.membersOf().length,
    };
  }

  override async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    if (!(await this.load())) return new Response('Not found', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    if (this.ctx.getWebSockets().length > HUB_LIMITS.jamMaxMembers) {
      send(server, { type: 'error', code: 'jam_full' });
      server.close(CLOSE_FULL, 'jam_full');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const msg = typeof raw === 'string' ? parseClientMessage(raw) : null;
    if (!msg) return this.fail(ws, 'invalid_request');
    const data = await this.load();
    if (!data) return this.close(ws);
    if (msg.type === 'hello') return this.handleHello(ws, data, msg);
    const actor = memberOf(ws);
    if (!actor) return this.fail(ws, 'invalid_request');
    await this.handleAction(ws, data, actor, msg);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close();
    await this.broadcast();
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  override async alarm(): Promise<void> {
    await this.endJam('expired');
  }

  private async load(): Promise<JamData | null> {
    const data = await this.ctx.storage.get<JamData>(STORAGE_KEY);
    if (!data) return null;
    if (data.expiresAt <= Date.now()) {
      await this.endJam('expired');
      return null;
    }
    return data;
  }

  private membersOf(): JamMember[] {
    return this.ctx.getWebSockets().flatMap((ws) => memberOf(ws) ?? []);
  }

  private fail(ws: WebSocket, code: HubErrorCode): void {
    send(ws, { type: 'error', code });
  }

  private close(ws: WebSocket): void {
    send(ws, { type: 'ended', reason: 'expired' });
    ws.close(CLOSE_ENDED, 'ended');
  }

  // A client that reconnects (network change, drop) may arrive before the old socket is seen as
  // closed. The memberId is never published, so the newest socket wins.
  private replaceStaleSocket(memberId: string): void {
    for (const old of this.ctx.getWebSockets()) {
      if (memberOf(old)?.memberId !== memberId) continue;
      old.serializeAttachment(null);
      old.close(CLOSE_REPLACED, 'replaced');
    }
  }

  private async handleHello(
    ws: WebSocket,
    data: JamData,
    msg: Extract<JamClientMessage, { type: 'hello' }>,
  ): Promise<void> {
    if (memberOf(ws)) return this.fail(ws, 'invalid_request');
    const nickname = normalizeNickname(msg.nickname);
    if (!nickname) return this.fail(ws, 'invalid_request');
    this.replaceStaleSocket(msg.memberId);
    const isHost = msg.hostKey
      ? await safeEqual(await sha256Hex(msg.hostKey), data.hostKeyHash)
      : false;
    ws.serializeAttachment({ memberId: msg.memberId, nickname, isHost } satisfies JamMember);
    await this.broadcast();
  }

  private async handleAction(
    ws: WebSocket,
    data: JamData,
    actor: JamMember,
    msg: JamClientMessage,
  ): Promise<void> {
    const result = applyAction(data, actor, msg, Date.now(), crypto.randomUUID());
    if ('error' in result) return this.fail(ws, result.error);
    if (msg.type === 'end') return this.endJam('host');
    await this.ctx.storage.put(STORAGE_KEY, result.data);
    await this.broadcast(result.data);
  }

  private async broadcast(current?: JamData): Promise<void> {
    const data = current ?? (await this.ctx.storage.get<JamData>(STORAGE_KEY));
    if (!data) return;
    const members = this.membersOf();
    for (const ws of this.ctx.getWebSockets()) {
      const you = memberOf(ws);
      if (you) send(ws, { type: 'state', jam: toSnapshot(data, members, you.memberId), you });
    }
  }

  private async endJam(reason: 'host' | 'expired'): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      send(ws, { type: 'ended', reason });
      ws.close(CLOSE_ENDED, 'ended');
    }
    await this.ctx.storage.deleteAll();
  }
}
