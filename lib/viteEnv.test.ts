import { __resetViteEnvCache, getViteEnvVar } from './viteEnv';

const runtime = globalThis as typeof globalThis & { __CAFE_VITE_ENV__?: Record<string, string> };

afterEach(() => {
  delete runtime.__CAFE_VITE_ENV__;
  __resetViteEnvCache();
});

test('reads the compiled revision and public API URL without dynamic code execution', () => {
  runtime.__CAFE_VITE_ENV__ = { VITE_APP_VERSION: '50cc25761ebe', VITE_API_BASE_URL: 'https://api.example.com' };
  __resetViteEnvCache();
  expect(getViteEnvVar('VITE_APP_VERSION')).toBe('50cc25761ebe');
  expect(getViteEnvVar('VITE_API_BASE_URL')).toBe('https://api.example.com');
});

test('returns an empty value when no build environment is available', () => {
  delete runtime.__CAFE_VITE_ENV__;
  __resetViteEnvCache();
  expect(getViteEnvVar('VITE_APP_VERSION')).toBe('');
});
