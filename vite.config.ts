import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

export default defineConfig(({ mode }) => {
  const _env = loadEnv(mode, '.', '');
  const resolveCommitSha = () => {
    const fromEnv = String(process.env.GITHUB_SHA || process.env.VITE_APP_VERSION || '').trim();
    if (fromEnv) return fromEnv.slice(0, 12);
    try {
      return execSync('git rev-parse --short=12 HEAD').toString().trim();
    } catch {
      return 'local';
    }
  };
  const buildVersion = resolveCommitSha();
  const buildTime = new Date().toISOString();

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'route-flag.js'],
        manifest: {
          name: 'CafeDuo - Kafe Oyun Platformu',
          short_name: 'CafeDuo',
          description: 'Kafede yan masadakiyle oyna, puan kazan, kafenin ödüllerinde harca.',
          theme_color: '#FFFFFF',
          background_color: '#FFFFFF',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          runtimeCaching: [
            {
              urlPattern: /\/api\/health$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-health-cache',
                expiration: { maxEntries: 1, maxAgeSeconds: 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    define: {
      __CAFE_VITE_ENV__: JSON.stringify({
        ...Object.fromEntries(Object.entries(_env).filter(([key]) => key.startsWith('VITE_'))),
        VITE_APP_VERSION: buildVersion,
        VITE_BUILD_TIME: buildTime,
      }),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildVersion),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Leaflet family → one dedicated chunk
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'vendor-leaflet';
            }
            // PixiJS family → one dedicated chunk (stages already use dynamic import;
            // this consolidates shared pixi helpers that might otherwise scatter)
            if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
              return 'vendor-pixi';
            }
            // Framer-motion → split from the main entry so the landing-page bundle
            // doesn't carry it on first paint for non-animated routes
            if (id.includes('node_modules/framer-motion')) {
              return 'vendor-framer';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
