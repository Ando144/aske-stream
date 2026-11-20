import type { CfRequest, CfResponse, CfTransport } from '../../src/cloudflare/types';

type Handler = (req: CfRequest) => CfResponse | Promise<CfResponse>;

export function ok(result: unknown, status = 200): CfResponse {
  return { status, body: JSON.stringify({ success: true, errors: [], result }) };
}

export function fail(status: number, ...codes: number[]): CfResponse {
  const errors = codes.map((code) => ({ code, message: 'x' }));
  return { status, body: JSON.stringify({ success: false, errors, result: null }) };
}

/** Records every request; routes are matched by "METHOD /path-prefix" (longest first). */
export class FakeCloudflare {
  readonly requests: CfRequest[] = [];
  private routes = new Map<string, Handler>();

  on(key: string, handler: Handler | CfResponse): this {
    this.routes.set(key, typeof handler === 'function' ? handler : () => handler);
    return this;
  }

  readonly transport: CfTransport = async (req) => {
    this.requests.push(req);
    const line = `${req.method} ${req.path}`;
    const keys = [...this.routes.keys()].sort((a, b) => b.length - a.length);
    const key = keys.find((k) => line.startsWith(k));
    if (!key) return ok(null);
    return this.routes.get(key)!(req);
  };

  req(i: number): CfRequest {
    const r = this.requests[i];
    if (!r) throw new Error(`no request #${i}`);
    return r;
  }

  lines(): string[] {
    return this.requests.map((r) => `${r.method} ${r.path}`);
  }
}
