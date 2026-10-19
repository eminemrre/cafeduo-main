/** @jest-environment node */
const express = require('express');
const http = require('node:http');
const { installAsyncRouteErrors } = require('./asyncRouteErrors');

installAsyncRouteErrors();

const request = async (app, path) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    return await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${server.address().port}${path}`, (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => resolve({ status: response.statusCode, body }));
        })
        .on('error', reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const buildApp = () => {
  const app = express();
  const router = express.Router();
  router.get('/rejects', async () => {
    throw new Error('pool.connect timed out');
  });
  router.get('/ok', async (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', router);
  app.get('/error-handler-rejects', async (_req, _res, next) => next(new Error('first')));
  app.use(async (err, req, res, next) => {
    if (req.path === '/error-handler-rejects') throw new Error('second');
    return next(err);
  });
  app.use((err, _req, res, _next) => res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message }));
  return app;
};

describe('installAsyncRouteErrors', () => {
  let unhandled;
  const onUnhandled = (reason) => {
    unhandled = reason;
  };
  beforeEach(() => {
    unhandled = undefined;
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it('turns a rejected async handler into an error response instead of an unhandled rejection', async () => {
    const response = await request(buildApp(), '/api/rejects');
    await new Promise((resolve) => setImmediate(resolve));
    expect(response.status).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'pool.connect timed out',
    });
    expect(unhandled).toBeUndefined();
  });

  it('forwards a rejection from an async error handler to the next error handler', async () => {
    const response = await request(buildApp(), '/error-handler-rejects');
    expect(response.status).toBe(500);
    expect(JSON.parse(response.body).message).toBe('second');
    expect(unhandled).toBeUndefined();
  });

  it('leaves successful async handlers alone and is safe to install twice', async () => {
    installAsyncRouteErrors();
    const response = await request(buildApp(), '/api/ok');
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });
});
