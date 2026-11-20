import { registerPlugin } from '@capacitor/core';

import type { CfRequest, CfResponse, CfTransport } from '../cloudflare/types';

export type { CfRequest, CfResponse, CfTransport, FormPart } from '../cloudflare/types';

/** Native plugin (apps/mobile/android/.../CloudflareApiPlugin.java). */
interface CloudflareApiPlugin {
  request(req: CfRequest): Promise<CfResponse>;
}

const plugin = registerPlugin<CloudflareApiPlugin>('CloudflareApi');

/** Rejects with Error('network') when there is no connection. */
export const nativeCfTransport: CfTransport = async (req) => {
  try {
    return await plugin.request(req);
  } catch (e) {
    if ((e as { code?: string }).code === 'network') throw new Error('network');
    throw e;
  }
};
