import { registerPlugin } from '@capacitor/core';

/** Native plugin (apps/mobile/android/.../QrScannerPlugin.java). */
export interface QrScannerPlugin {
  /** Rejects with code 'cancelled' (user closed it) or 'unavailable'. */
  scan(): Promise<{ text: string }>;
}

export const QrScanner = registerPlugin<QrScannerPlugin>('QrScanner');

/** Text of the scanned QR, or null if the user cancelled. Throws Error('qr_unavailable'). */
export async function scanQr(): Promise<string | null> {
  try {
    const { text } = await QrScanner.scan();
    return text;
  } catch (e) {
    if ((e as { code?: string }).code === 'cancelled') return null;
    throw new Error('qr_unavailable');
  }
}
