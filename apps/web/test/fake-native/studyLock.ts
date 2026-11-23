import type { PinState, StudyLockPlugin } from '../../src/native/studyLock';

let pin: PinState = 'none';

/** In-memory stand-in for the study-mode plugin. */
export const StudyLock: StudyLockPlugin = {
  pin: async () => {
    pin = 'pinned';
  },
  unpin: async () => {
    pin = 'none';
  },
  status: async () => ({ pin, lastChimedEndsAt: null }),
  scheduleChime: async () => ({ exact: true }),
  cancelChime: async () => undefined,
  chimeNow: async () => undefined,
  openPinSettings: async () => undefined,
};
