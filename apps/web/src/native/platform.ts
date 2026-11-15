import { Capacitor } from '@capacitor/core';

/** True inside the Android app; false in a browser (desktop web, iPhone, PWA). */
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
