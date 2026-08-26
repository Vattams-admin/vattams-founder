import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// VATTAMS ACADEMIA — build config.
//
// PWA notes (read before touching runtimeCaching):
// - registerType is 'prompt', not 'autoUpdate'. autoUpdate applies a new
//   service worker as soon as it's downloaded, which can yank a user off
//   the version they're mid-session on. 'prompt' downloads the update in
//   the background and only activates it once the user acts on the
//   update toast (src/components/UpdateToast.tsx) — no forced reloads.
// - There is deliberately NO runtimeCaching entry for Firebase Auth,
//   Firestore, or Firebase Storage. Storage URLs in particular serve both
//   public (course thumbnails, branding) and private (course materials,
//   certificates) files under the same host, distinguished only by a
//   token in the query string — a blanket CacheFirst rule there would
//   risk caching private material to disk. Only the built app shell
//   (JS/CSS/HTML) and same-origin static assets get precached.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
    filename: 'sw.js',
    registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'robots.txt',
        'icons/favicon-48.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'VATTAMS ACADEMIA',
        short_name: 'VATTAMS ACADEMIA',
        description:
          'A professional education platform for courses, competitive exams, competitions and VATTAMS ACADEMIA certifications.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#0B1730',
        background_color: '#0B1730',
        lang: 'en-IN',
        dir: 'ltr',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
            mode: 'development',
        // Only precache the built app shell + same-origin static assets —
        // never API/data responses. globIgnores keeps this from also
        // sweeping up source maps into the precache manifest.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/*.map'],
        // Belt-and-braces alongside "no runtimeCaching for these hosts":
        // the SPA navigateFallback (index.html) must never be served for
        // an actual Firebase/Google API call, and no route in this app is
        // literally prefixed /api or /auth, so these are inert unless
        // that changes later.
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
});
