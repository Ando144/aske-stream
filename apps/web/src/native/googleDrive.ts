import { registerPlugin } from '@capacitor/core';

/** Android: Google sign-in for Drive through Google Play services (GoogleDrivePlugin.java). */
export interface GoogleDrivePlugin {
  /** Rejects with code "consent_required" when interactive is false and Google needs a tap. */
  authorize(o: { interactive: boolean }): Promise<{ accessToken: string; email?: string }>;
  revoke(): Promise<void>;
}

export const GoogleDrive = registerPlugin<GoogleDrivePlugin>('GoogleDrive');
