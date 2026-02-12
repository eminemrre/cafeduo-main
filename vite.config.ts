import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
// import { VitePWA } from 'vite-plugin-pwa'; // TODO: Vite 7 uyumlu versiyonla güncellenecek

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      react(),
      // TODO: PWA support - Vite 7 uyumlu vite-plugin-pwa@0.22.0+ ile güncellenecek
      // VitePWA({
      //   registerType: 'autoUpdate',
      //   manifest: { ... }
      // })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildVersion),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
