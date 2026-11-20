// Single source of truth for the Cloudflare transport types; native/cloudflareApi.ts re-exports them.
export interface FormPart {
  name: string;
  value: string;
  filename?: string;
  contentType?: string;
}

export interface CfRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Starts with '/', relative to https://api.cloudflare.com/client/v4 */
  path: string;
  /** API token or the asset-upload JWT. */
  bearer: string;
  json?: unknown;
  form?: FormPart[];
}

export interface CfResponse {
  status: number;
  body: string;
}

export type CfTransport = (req: CfRequest) => Promise<CfResponse>;

export interface Migration {
  name: string;
  sql: string;
}

export interface WorkerBundleManifest {
  version: string;
  compatibilityDate: string;
  mainModule: 'index.js';
  migrations: Migration[];
  assets: Record<string, { hash: string; size: number }>;
}

export const SCRIPT_NAME = 'aske-stream';
export const D1_NAME = 'aske-stream';
export const BUCKET_NAME = 'aske-stream-media';

const TOKEN_PERMISSIONS = [
  { key: 'workers_scripts', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_r2', type: 'edit' },
  { key: 'account_settings', type: 'read' },
];

export const TOKEN_CREATE_URL =
  'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=' +
  encodeURIComponent(JSON.stringify(TOKEN_PERMISSIONS)) +
  '&name=Aske%20Stream&accountId=*&zoneId=all';

export type CfErrorCode =
  | 'invalid_token'
  | 'missing_permission'
  | 'r2_not_enabled'
  | 'subdomain_taken'
  | 'subdomain_invalid'
  | 'network'
  | 'rate_limited'
  | 'not_found'
  | 'unknown';

export class CfError extends Error {
  constructor(
    readonly code: CfErrorCode,
    readonly status: number,
    readonly cfCodes: number[],
  ) {
    super(`Cloudflare error: ${code} (HTTP ${status}, codes ${cfCodes.join(',') || 'none'})`);
    this.name = 'CfError';
  }
}
