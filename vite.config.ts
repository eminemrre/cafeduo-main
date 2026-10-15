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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name: 'CafeDuo - Kafe Oyun Platformu',
          short_name: 'CafeDuo',
          description: 'Kafelerde arkadaşlarınla oyun oyna, puan kazan, ödüller al!',
          theme_color: '#0f141a',
          background_color: '#0f141a',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>',
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>',
              sizes: '512x512',
              type: 'image/svg+xml',
            },
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
