import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      strategies: 'generateSW',
      filename: 'sw.js',

      // Detect new deployments automatically.
      // The application itself decides when it is safe to activate.
      registerType: 'prompt',

      injectRegister: false,

      includeAssets: [
        'robots.txt',
        'icons/favicon-48.png',
        'icons/apple-touch-icon.png',
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
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
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
        importScripts: ['push-sw.js'],
        mode: 'development',

        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/*.map'],

        navigateFallbackDenylist: [/^\/api/, /^\/auth/],

        // Remove obsolete Workbox precache entries automatically.
        cleanupOutdatedCaches: true,

        // New service worker can take control once the app explicitly
        // accepts the update.
        clientsClaim: true,
        skipWaiting: false,
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
  },
})
