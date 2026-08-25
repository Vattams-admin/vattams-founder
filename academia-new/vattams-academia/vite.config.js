import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// VATTAMS ACADEMIA — build configuration
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },

  plugins: [
    react(),

    VitePWA({
      // Temporarily disable service-worker generation.
      // This avoids the Workbox build failure on the current
      // Termux/Node environment. The application itself is unaffected.
      disable: true,

      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
      ],

      manifest: {
        name: 'VATTAMS ACADEMIA',
        short_name: 'Vattams',
        description: 'Learn. Compete. Certify. Grow.',
        theme_color: '#0B1730',
        background_color: '#0B1730',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],

        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vattams-public-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],

  server: {
    port: 5173,
  },
});
