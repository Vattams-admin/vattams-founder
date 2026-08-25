import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VATTAMS ACADEMIA — build config.
// Keep this file boring: real config (feature flags, pricing, etc.) lives in
// the database / env vars, never here.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'VATTAMS ACADEMIA',
        short_name: 'Vattams',
        description: 'Learn. Compete. Certify. Grow.',
        theme_color: '#0B1730',
        background_color: '#0B1730',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Never cache API/auth calls — only the app shell + static assets.
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/.*\/o\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vattams-public-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173 }
})
