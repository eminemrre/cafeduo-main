#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.PERF_BASE_URL || 'https://cafeduotr.com').replace(/\/+$/, '');
const REQUESTS = Math.max(5, Number(process.env.PERF_REQUESTS || 20));
const OUT_DIR = process.env.PERF_OUT_DIR || 'docs/reports';
const TIMEOUT_MS = Math.max(2000, Number(process.env.PERF_TIMEOUT_MS || 12000));
const HEALTH_P95_MAX_MS = Number(process.env.PERF_HEALTH_P95_MAX_MS || 500);
const META_P95_MAX_MS = Number(process.env.PERF_META_P95_MAX_MS || 300);
const LOGIN_P95_MAX_MS = Number(process.env.PERF_LOGIN_P95_MAX_MS || 500);

const endpoints = [
  {
    key: 'health',
    method: 'GET',
    path: '/health',
    expectedStatuses: [200],
  },
  {
    key: 'meta_version',
    method: 'GET',
    path: '/api/meta/version',
    expectedStatuses: [200],
  },
  {
    key: 'auth_invalid_login',
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'perf.invalid@example.com', password: 'wrong-pass-123' }),
    expectedStatuses: [401, 429],
  },
];

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
};

const mean = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const durationMs = performance.now() - startedAt;
    return { ok: true, status: response.status, durationMs };
  } catch {
    const durationMs = performance.now() - startedAt;
    return { ok: false, status: 0, durationMs };
  } finally {
    clearTimeout(timeout);
  }
};

const runEndpoint = async (endpoint) => {
  const durations = [];
  const statuses = [];
  let successCount = 0;

  for (let i = 0; i < REQUESTS; i += 1) {
    const result = await fetchWithTimeout(`${BASE_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: endpoint.headers,
      body: endpoint.body,
    });
    durations.push(result.durationMs);
    statuses.push(result.status);
    const statusMatch = endpoint.expectedStatuses.includes(result.status);
    if (result.ok && statusMatch) successCount += 1;
  }

  return {
    endpoint: endpoint.key,
    method: endpoint.method,
    path: endpoint.path,
    requests: REQUESTS,
    successRate: (successCount / REQUESTS) * 100,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    avgMs: mean(durations),
    maxMs: Math.max(...durations),
    statuses: [...new Set(statuses)].sort((a, b) => a - b),
  };
};

const buildMarkdown = (results) => {
  const now = new Date().toISOString();
  const lines = [
    '# API P95 Baseline',
    '',
    `- Base URL: \`${BASE_URL}\``,
    `- Requests per endpoint: \`${REQUESTS}\``,
    `- Generated at (UTC): \`${now}\``,
    '',
    '| Endpoint | Method | Requests | Success % | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Max (ms) | Statuses |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];

  for (const row of results) {
    lines.push(
      `| \`${row.path}\` | ${row.method} | ${row.requests} | ${row.successRate.toFixed(1)} | ${row.p50Ms.toFixed(1)} | ${row.p95Ms.toFixed(1)} | ${row.p99Ms.toFixed(1)} | ${row.avgMs.toFixed(1)} | ${row.maxMs.toFixed(1)} | ${row.statuses.join(', ')} |`
    );
  }

  return `${lines.join('\n')}\n`;
};

const run = async () => {
  const results = [];
  for (const endpoint of endpoints) {
    const report = await runEndpoint(endpoint);
    results.push(report);
  }

  const payload = {
    baseUrl: BASE_URL,
    requests: REQUESTS,
    generatedAt: new Date().toISOString(),
    results,
  };

  const markdown = buildMarkdown(results);
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'api-p95-latest.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'api-p95-latest.md'), markdown);
  process.stdout.write(markdown);

  const resultByKey = new Map(results.map((item) => [item.endpoint, item]));
  const thresholdChecks = [
    { key: 'health', label: '/health', maxMs: HEALTH_P95_MAX_MS },
    { key: 'meta_version', label: '/api/meta/version', maxMs: META_P95_MAX_MS },
    { key: 'auth_invalid_login', label: '/api/auth/login (invalid)', maxMs: LOGIN_P95_MAX_MS },
  ];

  const failures = thresholdChecks
    .map((check) => {
      const item = resultByKey.get(check.key);
      if (!item) return `${check.label}: no data`;
      if (item.successRate < 100) return `${check.label}: successRate=${item.successRate.toFixed(1)}%`;
      if (item.p95Ms > check.maxMs) return `${check.label}: p95=${item.p95Ms.toFixed(1)}ms > ${check.maxMs}ms`;
      return null;
    })
    .filter(Boolean);

  if (failures.length > 0) {
    process.stderr.write(`[api-p95] threshold check failed:\n- ${failures.join('\n- ')}\n`);
    process.exit(1);
  }
};

run().catch((error) => {
  process.stderr.write(`[api-p95] failed: ${error.message}\n`);
  process.exit(1);
});
