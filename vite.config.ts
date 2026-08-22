import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// VATTAMS ACADEMIA — build config.
// Keep this file boring: real config (feature flags, pricing, etc.) lives in
// Firestore / env vars, never here.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['branding/logo.png'],
      manifest: {
        name: 'VATTAMS ACADEMIA',
        short_name: 'Vattams',
        description: 'Learn. Compete. Certify. Grow.',
        theme_color: '#0B1730',
        background_color: '#0B1730',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/branding/logo-header.png', sizes: '200x200', type: 'image/png' },
          { src: '/branding/logo-large.png', sizes: '1254x1254', type: 'image/png' }
        ]
      },
      workbox: {
        // App shell + static assets only — Firestore/Auth/Storage calls are
        // never cached here, so students always see live data.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: { port: 5173 }
})