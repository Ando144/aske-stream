import type { CfRequest, CfResponse, CfTransport } from '../../src/native/cloudflareApi';

export type { CfRequest, CfResponse, CfTransport, FormPart } from '../../src/native/cloudflareApi';

declare global {
  interface Window {
    __askeFakeCf?: (req: CfRequest) => Promise<CfResponse> | CfResponse;
  }
}

/** Stand-in transport: delegates to window.__askeFakeCf if a test set it, otherwise "network". */
export const nativeCfTransport: CfTransport = async (req) => {
  if (!window.__askeFakeCf) throw new Error('network');
  return window.__askeFakeCf(req);
};
