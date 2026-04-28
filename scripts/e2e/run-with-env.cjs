const { spawn } = require('child_process');

const [rawCommand, ...args] = process.argv.slice(2);

if (!rawCommand) {
  console.error('Usage: node scripts/e2e/run-with-env.cjs <command> [...args]');
  process.exit(1);
}

const command =
  process.platform === 'win32' && rawCommand === 'npm'
    ? 'npm.cmd'
    : rawCommand;

const env = {
  ...process.env,
  NODE_ENV: 'development',
  JWT_SECRET: process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173',
  COOKIE_DOMAIN: '',
  AUTH_RATE_LIMIT_WINDOW_MS: '60000',
  AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: '500',
  AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS: '500',
  API_RATE_LIMIT_MAX_REQUESTS: '5000',
  RATE_LIMIT_MAX_REQUESTS: '5000',
};

const child = spawn(command, args, {
  env,
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
