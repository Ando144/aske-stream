import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Our own small native plugin (apps/mobile/android/.../AskeNativePlugin.java). */
export interface AskeNativePlugin {
  appInfo(): Promise<{
    version: string;
    build: number;
    canInstallUpdates: boolean;
    androidVersion: string;
    abis?: string[];
  }>;
  /** Free / total internal storage of the phone. */
  storageInfo(): Promise<{ freeBytes: number; totalBytes: number }>;
  batteryStatus(): Promise<{ unrestricted: boolean }>;
  requestBatteryExemption(): Promise<void>;
  /** Keeps CPU and Wi-Fi awake while music plays with the screen off. */
  keepAwake(options: { playing: boolean }): Promise<void>;
  downloadUpdate(options: {
    url: string;
    version: string;
  }): Promise<{ path: string; bytes: number }>;
  installUpdate(options: { path: string }): Promise<void>;
  openInstallSettings(): Promise<void>;
  addListener(
    event: 'updateProgress',
    listener: (p: { received: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const AskeNative = registerPlugin<AskeNativePlugin>('AskeNative');
