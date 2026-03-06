#!/usr/bin/env node

import { io } from 'socket.io-client';

const baseUrl = (process.env.SMOKE_BASE_URL || process.argv[2] || 'https://cafeduotr.com').replace(/\/+$/, '');
const expectedCommit = String(process.env.SMOKE_EXPECT_COMMIT || '').trim();
const loginEmail = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const loginPassword = String(process.env.SMOKE_LOGIN_PASSWORD || '');

const printStep = (message) => {
  process.stdout.write(`\n[smoke] ${message}\n`);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createCookieJar = () => new Map();

const getSetCookieHeaders = (headers) => {
  if (headers && typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const singleHeader = headers?.get?.('set-cookie');
  return singleHeader ? [singleHeader] : [];
};

const applySetCookieHeaders = (cookieJar, headers) => {
  const setCookieHeaders = getSetCookieHeaders(headers);
  for (const headerValue of setCookieHeaders) {
    const [cookiePairRaw] = String(headerValue || '').split(';');
    const separatorIndex = cookiePairRaw.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = cookiePairRaw.slice(0, separatorIndex).trim();
    const value = cookiePairRaw.slice(separatorIndex + 1).trim();

    if (!name) {
      continue;
    }

    if (!value) {
      cookieJar.delete(name);
      continue;
    }

    cookieJar.set(name, value);
  }
};

const serializeCookieJar = (cookieJar) =>
  Array.from(cookieJar.entries())
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const fetchWithCookies = async (url, cookieJar, options = {}, timeoutMs = 12000) => {
  const headers = new Headers(options.headers || {});
  const cookieHeader = serializeCookieJar(cookieJar);
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    timeoutMs
  );

  applySetCookieHeaders(cookieJar, response.headers);
  return response;
};

const checkHealth = async () => {
  printStep(`Health check: ${baseUrl}/health`);
  const response = await fetchWithTimeout(`${baseUrl}/health`);
  assert(response.ok, `Health endpoint failed with status ${response.status}`);
  const body = await response.json();
  const isHealthy =
    body?.status === 'healthy' ||
    body?.message === 'OK' ||
    (typeof body?.uptime === 'number' && body?.uptime >= 0);
  assert(isHealthy, 'Health payload is missing expected health indicators');
};

const checkInvalidLoginResponse = async () => {
  printStep('Auth check: invalid login must return controlled error');
  const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoke.invalid@example.com', password: 'wrong-pass-123' }),
  });

  assert(
    response.status === 401 || response.status === 429,
    `Unexpected login status: ${response.status} (expected 401 or 429)`
  );

  const text = await response.text();
  assert(text.length > 0, 'Login error response should not be empty');
};

const checkVersionMeta = async () => {
  printStep(`Version check: ${baseUrl}/api/meta/version`);
  const response = await fetchWithTimeout(`${baseUrl}/api/meta/version`);
  assert(response.ok, `Version endpoint failed with status ${response.status}`);
  const body = await response.json();
  assert(typeof body?.commit === 'string' && body.commit.length > 0, 'Version payload missing commit');
  if (expectedCommit) {
    assert(
      body.commit === expectedCommit,
      `Version commit mismatch: expected ${expectedCommit}, got ${body.commit}`
    );
  }
};

const checkAuthenticatedSocket = async (cookieHeader, expectedSuccess = true) => {
  const modeLabel = expectedSuccess ? 'authenticated socket.io handshake' : 'revoked socket.io handshake';
  printStep(`Realtime check: ${modeLabel}`);

  await new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
      extraHeaders: cookieHeader ? { Cookie: cookieHeader } : {},
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 12000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.disconnect();
      if (expectedSuccess) {
        resolve(true);
        return;
      }
      reject(new Error('Socket connection unexpectedly succeeded after logout'));
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      if (!expectedSuccess) {
        resolve(error);
        return;
      }
      reject(error);
    });
  });
};

const runAuthenticatedChecks = async () => {
  if (!loginEmail || !loginPassword) {
    printStep('Skipping authenticated checks (SMOKE_LOGIN_EMAIL/PASSWORD not set)');
    return;
  }

  const cookieJar = createCookieJar();

  printStep('Auth check: valid login + Set-Cookie + /auth/me');
  const loginResponse = await fetchWithCookies(`${baseUrl}/api/auth/login`, cookieJar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });

  assert(loginResponse.ok, `Valid login failed: ${loginResponse.status}`);
  const loginBody = await loginResponse.json();
  assert(loginBody?.user?.id || loginBody?.id, 'Valid login response must include a user payload');

  const authCookieHeader = serializeCookieJar(cookieJar);
  assert(authCookieHeader.includes('auth_token='), 'Login did not set auth_token cookie');

  const meResponse = await fetchWithCookies(`${baseUrl}/api/auth/me`, cookieJar);
  assert(meResponse.ok, `/api/auth/me failed with cookie auth: ${meResponse.status}`);

  await checkAuthenticatedSocket(authCookieHeader, true);

  printStep('Auth check: logout clears cookie and revokes old socket token');
  const logoutResponse = await fetchWithCookies(`${baseUrl}/api/auth/logout`, cookieJar, {
    method: 'POST',
  });
  assert(logoutResponse.ok, `Logout failed: ${logoutResponse.status}`);

  const meAfterLogout = await fetchWithCookies(`${baseUrl}/api/auth/me`, cookieJar);
  assert(
    meAfterLogout.status === 401 || meAfterLogout.status === 403,
    `Expected /api/auth/me to fail after logout, got ${meAfterLogout.status}`
  );

  await checkAuthenticatedSocket(authCookieHeader, false);
};

const run = async () => {
  printStep(`Starting smoke tests against ${baseUrl}`);
  await checkHealth();
  await checkVersionMeta();
  await checkInvalidLoginResponse();
  await runAuthenticatedChecks();
  printStep('Smoke tests completed successfully');
};

run().catch((error) => {
  process.stderr.write(`\n[smoke] FAILED: ${error.message}\n`);
  process.exit(1);
});
