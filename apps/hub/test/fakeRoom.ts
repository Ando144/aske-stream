import { vi } from 'vitest';

export class FakeDurableObject {
  constructor(
    public ctx: unknown,
    public env: unknown,
  ) {}
}

export class FakeSocket {
  sent: Array<Record<string, unknown>> = [];
  closed: { code?: number; reason?: string } | null = null;
  private attachment: unknown = null;
  send(text: string) {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
  close(code?: number, reason?: string) {
    this.closed ??= { code, reason };
  }
  serializeAttachment(value: unknown) {
    this.attachment = value;
  }
  deserializeAttachment() {
    return this.attachment;
  }
  last() {
    return this.sent[this.sent.length - 1];
  }
}

export class FakeCtx {
  store = new Map<string, unknown>();
  alarm: number | null = null;
  sockets: FakeSocket[] = [];
  storage = {
    get: async (key: string) => this.store.get(key),
    put: async (key: string, value: unknown) => void this.store.set(key, value),
    setAlarm: async (at: number) => void (this.alarm = at),
    deleteAll: async () => void this.store.clear(),
  };
  acceptWebSocket(ws: FakeSocket) {
    this.sockets.push(ws);
  }
  getWebSockets() {
    return this.sockets;
  }
}

export function installWebSocketPair(created: FakeSocket[]) {
  vi.stubGlobal(
    'WebSocketPair',
    class {
      0 = new FakeSocket();
      1 = new FakeSocket();
      constructor() {
        created.push(this[0], this[1]);
      }
    },
  );
}
