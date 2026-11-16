import type { AskeNativePlugin } from '../../src/native/askeNative';

/** No-op stand-in for the native helper plugin. */
export const AskeNative: AskeNativePlugin = {
  appInfo: async () => ({
    version: 'fake',
    build: 0,
    canInstallUpdates: true,
    androidVersion: '16',
  }),
  keepAwake: async () => undefined,
  batteryStatus: async () => ({ unrestricted: false }),
  requestBatteryExemption: async () => undefined,
  storageInfo: async () => ({ freeBytes: 21_474_836_480, totalBytes: 128_849_018_880 }),
  downloadUpdate: async () => ({ path: '/fake.apk', bytes: 1 }),
  installUpdate: async () => undefined,
  openInstallSettings: async () => undefined,
  addListener: async () => ({ remove: async () => undefined }),
};
