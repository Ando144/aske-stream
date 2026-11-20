import type { CfApi } from './api';
import { BUCKET_NAME, SCRIPT_NAME, type FormPart, type WorkerBundleManifest } from './types';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  txt: 'text/plain',
};

interface UploadSession {
  jwt: string;
  buckets?: string[][];
}

interface ScriptOptions {
  code: string;
  manifest: WorkerBundleManifest;
  assetsJwt: string;
  d1Id: string;
  accessKey?: string;
}

function contentTypeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export async function uploadAssets(
  api: CfApi,
  accountId: string,
  manifest: WorkerBundleManifest,
  readAsset: (path: string) => Promise<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const base = `/accounts/${accountId}/workers`;
  const files = Object.fromEntries(
    Object.entries(manifest.assets).map(([p, a]) => [p, { hash: a.hash, size: a.size }]),
  );
  const session = await api.call<UploadSession>(
    'POST',
    `${base}/scripts/${SCRIPT_NAME}/assets-upload-session`,
    { json: { manifest: files } },
  );
  const pathByHash = new Map(Object.entries(manifest.assets).map(([p, a]) => [a.hash, p]));
  const buckets = session.buckets ?? [];
  const total = buckets.reduce((n, b) => n + b.length, 0);
  let jwt = session.jwt;
  let done = 0;
  for (const bucket of buckets) {
    const form: FormPart[] = [];
    for (const hash of bucket) {
      const path = pathByHash.get(hash) ?? '';
      form.push({
        name: hash,
        value: await readAsset(path),
        filename: hash,
        contentType: contentTypeOf(path),
      });
    }
    const r = await api.call<{ jwt?: string } | null>(
      'POST',
      `${base}/assets/upload?base64=true`,
      { form },
      session.jwt,
    );
    if (r?.jwt) jwt = r.jwt;
    done += bucket.length;
    onProgress?.(done, total);
  }
  return jwt;
}

export function buildMetadata(o: Omit<ScriptOptions, 'code'>): Record<string, unknown> {
  const bindings: Record<string, unknown>[] = [
    { type: 'd1', name: 'DB', id: o.d1Id },
    { type: 'r2_bucket', name: 'BUCKET', bucket_name: BUCKET_NAME },
    { type: 'assets', name: 'ASSETS' },
  ];
  if (o.accessKey) bindings.push({ type: 'secret_text', name: 'ACCESS_KEY', text: o.accessKey });
  return {
    main_module: 'index.js',
    compatibility_date: o.manifest.compatibilityDate,
    bindings,
    ...(o.accessKey ? {} : { keep_bindings: ['secret_text', 'plain_text'] }),
    assets: {
      jwt: o.assetsJwt,
      config: {
        not_found_handling: 'single-page-application',
        run_worker_first: ['/api/*', '/media/*'],
      },
    },
    observability: { enabled: true },
  };
}

export async function uploadScript(api: CfApi, accountId: string, o: ScriptOptions): Promise<void> {
  const form: FormPart[] = [
    { name: 'metadata', value: JSON.stringify(buildMetadata(o)), contentType: 'application/json' },
    {
      name: 'index.js',
      value: o.code,
      filename: 'index.js',
      contentType: 'application/javascript+module',
    },
  ];
  await api.call('PUT', `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}`, { form });
}

export async function enableWorkersDev(api: CfApi, accountId: string): Promise<void> {
  await api.call('POST', `/accounts/${accountId}/workers/scripts/${SCRIPT_NAME}/subdomain`, {
    json: { enabled: true, previews_enabled: false },
  });
}

export function workerUrl(subdomain: string): string {
  return `https://${SCRIPT_NAME}.${subdomain}.workers.dev`;
}
