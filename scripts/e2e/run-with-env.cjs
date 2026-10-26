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
  // Keep e-mails in memory for the E2E inbox (GET /api/test/emails); never real sends.
  EMAIL_CAPTURE: 'true',
  JWT_SECRET: process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173',
  COOKIE_DOMAIN: '',
  AUTH_RATE_LIMIT_WINDOW_MS: '60000',
  AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: '500',
  AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS: '500',
  API_RATE_LIMIT_MAX_REQUESTS: '5000',
  RATE_LIMIT_MAX_REQUESTS: '5000',
  // E2E admin bootstrap: promoteBootstrapAdmins memory mode'da da calisir.
  // Turnuva / cafe-admin / konum editoru testleri icin sabit admin hesabi.
  BOOTSTRAP_ADMIN_EMAILS: process.env.BOOTSTRAP_ADMIN_EMAILS || 'e2e.admin@example.com',
  BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'E2eAdmin!2026',
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
