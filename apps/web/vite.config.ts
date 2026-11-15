import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from '../../package.json' with { type: 'json' };

const API_TARGET = process.env.ASKE_API_URL ?? 'http://127.0.0.1:8787';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Aske Stream',
        short_name: 'Aske',
        description: 'Your own music cloud: stream, organise and keep music offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14110f',
        theme_color: '#14110f',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell is precached so the PWA opens without a connection.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // hls.js is only needed for live radio, which requires a connection anyway.
        globIgnores: ['**/hls*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        // Covers are immutable: cache-first keeps artwork visible offline.
        // Audio is NOT handled here: the offline engine stores full files in
        // Cache Storage itself and plays them through blob: URLs, which keeps
        // HTTP Range seeking working for online streaming.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/cover/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'aske-covers',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/media': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
});
