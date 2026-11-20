import {
  CfError,
  type CfErrorCode,
  type CfRequest,
  type CfTransport,
  type FormPart,
} from './types';

export interface CfApi {
  call<T>(
    method: CfRequest['method'],
    path: string,
    body?: { json?: unknown; form?: FormPart[] },
    bearer?: string,
  ): Promise<T>;
}

interface Envelope {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: unknown;
}

function parseEnvelope(body: string): Envelope | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Envelope) : null;
  } catch {
    return null;
  }
}

function classify(status: number, codes: number[]): CfErrorCode {
  if (codes.includes(10042)) return 'r2_not_enabled';
  if (codes.includes(10036)) return 'subdomain_taken';
  if (status === 429) return 'rate_limited';
  if (status === 404) return 'not_found';
  if (codes.includes(9109) || status === 403) return 'missing_permission';
  if (codes.includes(10000) || status === 401) return 'invalid_token';
  return 'unknown';
}

export function createCfApi(transport: CfTransport, token: string): CfApi {
  return {
    async call<T>(
      method: CfRequest['method'],
      path: string,
      body?: { json?: unknown; form?: FormPart[] },
      bearer: string = token,
    ): Promise<T> {
      let res;
      try {
        res = await transport({ method, path, bearer, json: body?.json, form: body?.form });
      } catch {
        throw new CfError('network', 0, []);
      }
      const env = parseEnvelope(res.body);
      const ok = res.status >= 200 && res.status < 300 && env?.success !== false;
      if (ok && env) return env.result as T;
      const codes = (env?.errors ?? []).map((e) => e.code).filter((c): c is number => !!c);
      throw new CfError(classify(res.status, codes), res.status, codes);
    },
  };
}
