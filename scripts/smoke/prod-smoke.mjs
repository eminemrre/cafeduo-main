#!/usr/bin/env node

import { io } from 'socket.io-client';

const baseUrl = (process.env.SMOKE_BASE_URL || process.argv[2] || 'https://cafeduotr.com').replace(/\/+$/, '');

const printStep = (message) => {
  process.stdout.write(`\n[smoke] ${message}\n`);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

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
};

const checkOptionalValidLogin = async () => {
  const email = process.env.SMOKE_LOGIN_EMAIL;
  const password = process.env.SMOKE_LOGIN_PASSWORD;
  if (!email || !password) {
    printStep('Skipping valid login check (SMOKE_LOGIN_EMAIL/PASSWORD not set)');
    return;
  }

  printStep('Auth check: valid login + /auth/me');
  const loginResponse = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assert(loginResponse.ok, `Valid login failed: ${loginResponse.status}`);
  const loginBody = await loginResponse.json();
  assert(loginBody?.token, 'Valid login response must include token');

  const meResponse = await fetchWithTimeout(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${loginBody.token}`,
    },
  });
  assert(meResponse.ok, `/api/auth/me failed: ${meResponse.status}`);
};

const checkSocketHandshake = async () => {
  printStep('Realtime check: socket.io handshake');

  await new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 12000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.disconnect();
      resolve(true);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
};

const run = async () => {
  printStep(`Starting smoke tests against ${baseUrl}`);
  await checkHealth();
  await checkVersionMeta();
  await checkInvalidLoginResponse();
  await checkOptionalValidLogin();
  await checkSocketHandshake();
  printStep('Smoke tests completed successfully');
};

run().catch((error) => {
  process.stderr.write(`\n[smoke] FAILED: ${error.message}\n`);
  process.exit(1);
});
