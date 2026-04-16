#!/usr/bin/env node

const encodedEnv = String(process.env.DEPLOY_ENV_B64 || '').trim();
const deploySiteUrl = String(process.env.DEPLOY_SITE_URL || '').trim();
const smokeLoginEmail = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const smokeLoginPassword = String(process.env.SMOKE_LOGIN_PASSWORD || '');

const fail = (message) => {
  process.stderr.write(`[validate-production-env] ${message}\n`);
  process.exit(1);
};

const parseEnvText = (text) => {
  const values = new Map();
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
};

if (!encodedEnv) {
  fail('DEPLOY_ENV_B64 is required.');
}

if (!deploySiteUrl) {
  fail('DEPLOY_SITE_URL is required.');
}

if (!smokeLoginEmail || !smokeLoginPassword) {
  fail('SMOKE_LOGIN_EMAIL and SMOKE_LOGIN_PASSWORD are required.');
}

let decodedEnv = '';
try {
  decodedEnv = Buffer.from(encodedEnv, 'base64').toString('utf8');
} catch (error) {
  fail(`DEPLOY_ENV_B64 could not be decoded: ${error instanceof Error ? error.message : String(error)}`);
}

const envMap = parseEnvText(decodedEnv);
const nodeEnv = String(envMap.get('NODE_ENV') || '').trim();
const cookieDomain = String(envMap.get('COOKIE_DOMAIN') || '').trim();
const corsOrigin = String(envMap.get('CORS_ORIGIN') || '').trim();
const jwtSecret = String(envMap.get('JWT_SECRET') || '').trim();

if (nodeEnv !== 'production') {
  fail(`NODE_ENV must be 'production', received '${nodeEnv || 'unset'}'.`);
}

if (cookieDomain) {
  fail('COOKIE_DOMAIN must be empty for same-origin production deployment.');
}

if (!jwtSecret || jwtSecret.length < 64) {
  fail('JWT_SECRET must be set and at least 64 characters long.');
}

let deploySiteOrigin = '';
try {
  deploySiteOrigin = new URL(deploySiteUrl).origin;
} catch (error) {
  fail(`DEPLOY_SITE_URL is not a valid URL: ${error instanceof Error ? error.message : String(error)}`);
}

const allowedOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.includes(deploySiteOrigin)) {
  fail(`CORS_ORIGIN must include DEPLOY_SITE_URL origin '${deploySiteOrigin}'.`);
}

process.stdout.write('[validate-production-env] Production environment validation passed.\n');
