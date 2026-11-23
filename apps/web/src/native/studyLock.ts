import { registerPlugin } from '@capacitor/core';

export type PinState = 'none' | 'pinned' | 'locked'; // pinned = screen pinning, locked = kiosk

/** Native plugin for study mode (apps/mobile/android/.../StudyLockPlugin.java). */
export interface StudyLockPlugin {
  /** startLockTask(); Android shows its own "Pin app?" dialog. Resolves at once. */
  pin(): Promise<void>;
  /** stopLockTask(); no error if it was not pinned. */
  unpin(): Promise<void>;
  status(): Promise<{ pin: PinState; lastChimedEndsAt: number | null }>;
  /** Exact alarm at endsAt that plays the chime if JS has not done it. */
  scheduleChime(o: { endsAt: number }): Promise<{ exact: boolean }>;
  cancelChime(): Promise<void>;
  /** Plays the 3 bells now, unless lastChimedEndsAt === endsAt. Cancels the alarm. */
  chimeNow(o: { endsAt: number }): Promise<void>;
  /** Opens Android Security settings (where "App pinning" lives). */
  openPinSettings(): Promise<void>;
}

export const StudyLock = registerPlugin<StudyLockPlugin>('StudyLock');
