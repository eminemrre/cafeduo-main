/**
 * Cross-platform runner for the protocol v2 Playwright suite.
 *
 * The E2E stack must start with GAME_ENGINE_V2_ENABLED=true. Setting that in an
 * npm script (`GAME_ENGINE_V2_ENABLED=true ...`) only works in POSIX shells, so
 * this wrapper sets it for the Playwright process and its webServer children.
 */

const { spawn } = require('child_process');

const forwarded = process.argv.slice(2);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
  'playwright',
  'test',
  '--project=chromium',
  '--grep',
  '@v2',
  ...forwarded,
];

const child = spawn(command, args, {
  env: { ...process.env, GAME_ENGINE_V2_ENABLED: 'true' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
