import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// Geolocation needs a secure context. On localhost plain HTTP is fine, but to
// test real GPS on a phone over the LAN you need HTTPS — opt in with HTTPS=1.
// e.g.  HTTPS=1 npm run dev   (PowerShell:  $env:HTTPS=1; npm run dev)
const useHttps = !!process.env.HTTPS;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate', // ship updates without a manual SW prompt
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'icons/favicon-16.png',
      ],
      manifest: {
        name: 'MaWay — מצא את הדרך שלך',
        short_name: 'MaWay',
        description: 'יצירת מסלולי ריצה ישרים ורציפים על המפה',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4A5A6B',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell so it opens instantly / offline.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        navigateFallback: '/index.html',
        // Deliberately NO runtime caching for the engine API or OSM map tiles —
        // routes and tiles must always be fresh, so they stay network-only.
        navigateFallbackDenylist: [/^\/loop/],
      },
    }),
  ],
  server: {
    host: true, // expose on the LAN so you can open it on a phone
    // Honor an assigned port (e.g. from tooling) if provided, else default 5173.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
