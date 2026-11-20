import type { JamClientMessage, JamServerMessage } from '@aske/shared/hub';

export type JamSocketStatus =
  'connecting' | 'open' | 'reconnecting' | 'replaced' | 'gaveUp' | 'closed';

/** The small part of WebSocket we use, so tests can fake it. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: (() => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

/** Close code the server uses when it will not accept the client any more. */
export const JAM_CLOSE_FINAL = 4000;
/** The server refuses new members (jam_full): retrying would never succeed. */
export const JAM_CLOSE_FULL = 1013;
/** Another tab/device of the same member took over this seat. Final: never reconnect. */
export const JAM_CLOSE_REPLACED = 4001;
const OPEN = 1;
const MAX_PENDING = 20;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
/** Stop retrying after this long without a connection; the user can reconnect by hand. */
export const MAX_RETRY_WINDOW_MS = 5 * 60 * 1000;

export class JamSocket {
  onMessage: (msg: JamServerMessage) => void = () => undefined;
  onStatus: (status: JamSocketStatus) => void = () => undefined;

  private socket: SocketLike | null = null;
  private url = '';
  private hello: JamClientMessage | null = null;
  private pending: JamClientMessage[] = [];
  private attempts = 0;
  private firstFailureAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(private readonly factory: SocketFactory) {}

  connect(url: string, hello: JamClientMessage): void {
    this.close();
    this.url = url;
    this.hello = hello;
    this.stopped = false;
    this.attempts = 0;
    this.firstFailureAt = null;
    this.onStatus('connecting');
    this.open();
  }

  send(msg: JamClientMessage): void {
    if (this.socket?.readyState === OPEN) {
      this.socket.send(JSON.stringify(msg));
      return;
    }
    if (this.stopped) return;
    this.pending.push(msg);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
  }

  close(): void {
    this.stopped = true;
    this.pending = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.close();
    this.onStatus('closed');
  }

  private open(): void {
    const socket = this.factory(this.url);
    this.socket = socket;
    socket.onopen = () => this.handleOpen(socket);
    socket.onmessage = (ev) => this.handleMessage(ev.data);
    socket.onerror = () => undefined; // a close event always follows
    socket.onclose = (ev) => this.handleClose(socket, ev.code);
  }

  private handleOpen(socket: SocketLike): void {
    this.attempts = 0;
    this.firstFailureAt = null;
    if (this.hello) socket.send(JSON.stringify(this.hello));
    const queued = this.pending;
    this.pending = [];
    for (const msg of queued) socket.send(JSON.stringify(msg));
    this.onStatus('open');
  }

  private handleMessage(data: unknown): void {
    let msg: JamServerMessage;
    try {
      msg = JSON.parse(String(data)) as JamServerMessage;
    } catch {
      return; // ignore malformed frames
    }
    if (msg.type === 'ended') this.stopped = true;
    this.onMessage(msg);
  }

  private handleClose(socket: SocketLike, code: number): void {
    if (this.socket !== socket) return;
    this.socket = null;
    if (code === JAM_CLOSE_REPLACED) {
      this.stopped = true;
      this.onStatus('replaced');
      return;
    }
    if (this.stopped || code === JAM_CLOSE_FINAL || code === JAM_CLOSE_FULL) {
      this.stopped = true;
      this.onStatus('closed');
      return;
    }
    this.firstFailureAt ??= Date.now();
    if (Date.now() - this.firstFailureAt >= MAX_RETRY_WINDOW_MS) {
      this.stopped = true;
      this.pending = [];
      this.onStatus('gaveUp');
      return;
    }
    const delay = Math.min(MIN_DELAY_MS * 2 ** this.attempts, MAX_DELAY_MS);
    this.attempts++;
    this.onStatus('reconnecting');
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.stopped) this.open();
    }, delay);
  }
}
