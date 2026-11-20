import type { QrScannerPlugin } from '../../src/native/qrScanner';

declare global {
  interface Window {
    __askeFakeQr?: string;
  }
}

/** Stand-in scanner: returns window.__askeFakeQr if a test set it, otherwise "cancelled". */
export const QrScanner: QrScannerPlugin = {
  scan: async () => {
    if (window.__askeFakeQr) return { text: window.__askeFakeQr };
    throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
  },
};

export async function scanQr(): Promise<string | null> {
  return window.__askeFakeQr ?? null;
}
