/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;

/** hls.js ships the "light" build (no subtitles/DRM) without its own typings. */
declare module 'hls.js/light' {
  export { default } from 'hls.js';
}
