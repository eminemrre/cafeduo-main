import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === '1';
const sharedE2EEnv = [
  'NODE_ENV=development',
  'CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173',
  'COOKIE_DOMAIN=',
  'AUTH_RATE_LIMIT_WINDOW_MS=60000',
  'AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=500',
  'AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS=500',
  'API_RATE_LIMIT_MAX_REQUESTS=5000',
  'RATE_LIMIT_MAX_REQUESTS=5000',
].join(' ');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Keep one worker to avoid auth rate-limit flakiness on shared test data. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: playwrightBaseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(!isCI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: `${sharedE2EEnv} node backend/server.js`,
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer,
      timeout: 120 * 1000,
    },
    {
      command: `${sharedE2EEnv} npm run client -- --host 0.0.0.0 --port 3000`,
      url: playwrightBaseUrl,
      reuseExistingServer,
      timeout: 120 * 1000,
    },
  ],
});
