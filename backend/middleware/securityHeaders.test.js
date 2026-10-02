/** @jest-environment node */
const express = require('express');
const helmet = require('helmet');
const http = require('node:http');
const { buildSecurityHeadersOptions } = require('./securityHeaders');

const readHeaders = async (production) => {
  const app = express();
  app.use(helmet(buildSecurityHeadersOptions({ production })));
  app.get('/', (_req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    return await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${server.address().port}`, (response) => {
          response.resume();
          response.on('end', () => resolve(response.headers));
        })
        .on('error', reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test('production responses prohibit eval/inline scripts and embedding without blocking local assets', async () => {
  const headers = await readHeaders(true),
    csp = headers['content-security-policy'];
  expect(csp).toContain("script-src 'self';");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
});
test('development retains the script and websocket support needed by Vite', async () => {
  const headers = await readHeaders(false);
  expect(headers['content-security-policy']).toContain('unsafe-eval');
  expect(headers['content-security-policy']).toContain('ws:');
  expect(headers['x-frame-options']).toBe('DENY');
});
