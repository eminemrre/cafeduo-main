/** @jest-environment node */
const { NodeClient } = require('@sentry/node');
const { createServerErrorReportingOptions } = require('./errorReporting');

describe('server diagnostic privacy hooks', () => {
  it.each(['event', 'transaction'])(
    'preserves SDK structure in a large %s envelope',
    async (kind) => {
      const envelopes = [];
      const client = new NodeClient({
        ...createServerErrorReportingOptions({
          dsn: 'https://public@example.invalid/1',
          environment: 'production',
        }),
        integrations: [],
        transport: () => ({
          send: async (envelope) => {
            envelopes.push(envelope);
            return { statusCode: 200 };
          },
          flush: async () => true,
        }),
      });
      const payload = {
        message: 'Large diagnostic event',
        breadcrumbs: Array.from({ length: 100 }, () => ({
          category: 'http',
          data: { url: '/dogrula?token=PRIVATE', status_code: 400, method: 'POST' },
        })),
        spans: Array.from({ length: 60 }, () => ({
          op: 'db',
          description: 'get blacklist:token:PRIVATE',
          data: { 'db.system': 'redis', 'db.statement': 'get blacklist:token:PRIVATE' },
          span_id: 'c'.repeat(16),
          trace_id: 'a'.repeat(32),
          start_timestamp: 1,
          timestamp: 2,
        })),
        exception: {
          values: [
            {
              type: 'Error',
              value: 'boom',
              stacktrace: {
                frames: Array.from({ length: 40 }, (_, lineno) => ({
                  filename: '/assets/app.js?token=PRIVATE',
                  lineno,
                  function: 'handler',
                })),
              },
            },
          ],
        },
        ...(kind === 'transaction'
          ? { type: 'transaction', transaction: 'POST /api/auth/reset-password' }
          : {}),
        start_timestamp: 1,
        timestamp: 2,
        release: 'test-release',
        environment: 'production',
        tags: { service: 'api' },
        contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) } },
        sdkProcessingMetadata: {
          dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public' },
        },
      };
      try {
        client.captureEvent(payload);
        expect(await client.flush(2000)).toBe(true);
        expect(envelopes).toHaveLength(1);
        const envelope = envelopes[0];
        expect(envelope[1][0][0].type).toBe(kind);
        const event = envelope[1][0][1];
        expect(event).toMatchObject({
          release: 'test-release',
          environment: 'production',
          timestamp: 2,
          tags: { service: 'api' },
        });
        expect(event.breadcrumbs).toHaveLength(100);
        expect(event.spans).toHaveLength(60);
        expect(envelope[0].trace.trace_id).toBe('a'.repeat(32));
        expect(JSON.stringify(envelope)).not.toContain('PRIVATE');
        expect(event).not.toHaveProperty('__truncated__');
      } finally {
        await client.close(2000);
      }
    }
  );

  it('sends only scrubbed error and transaction envelopes through the real SDK', async () => {
    const envelopes = [];
    const client = new NodeClient({
      ...createServerErrorReportingOptions({
        dsn: 'https://public@example.invalid/1',
        environment: 'production',
      }),
      integrations: [],
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(envelope);
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
    const request = {
      url: 'https://example.com/reset-password?token=PRIVATE',
      method: 'POST',
      query_string: 'token=PRIVATE',
      headers: { Referer: '/dogrula?token=PRIVATE' },
      data: { password: 'PRIVATE' },
    };
    try {
      client.captureEvent({ message: 'Reset failed', request });
      client.captureEvent({
        type: 'transaction',
        transaction: 'POST /api/auth/reset-password',
        start_timestamp: 1,
        timestamp: 2,
        request,
        contexts: {
          trace: {
            trace_id: 'a'.repeat(32),
            span_id: 'b'.repeat(16),
            data: { 'db.system': 'redis', 'db.statement': 'get blacklist:token:PRIVATE' },
          },
        },
        spans: [
          {
            op: 'db.redis',
            description: 'get blacklist:token:PRIVATE',
            data: {
              'db.system': 'redis',
              'db.statement': 'get blacklist:token:PRIVATE',
              'db.query.text': 'EVAL script PRIVATE',
              'db.operation': 'get',
            },
            span_id: 'c'.repeat(16),
            trace_id: 'a'.repeat(32),
            start_timestamp: 1,
            timestamp: 2,
          },
        ],
      });
      expect(await client.flush(2000)).toBe(true);
      expect(envelopes).toHaveLength(2);
      expect(JSON.stringify(envelopes)).not.toContain('PRIVATE');
      const events = envelopes.flatMap((envelope) => envelope[1].map((item) => item[1]));
      expect(events.map((event) => event.request)).toEqual([
        { url: 'https://example.com/reset-password', method: 'POST' },
        { url: 'https://example.com/reset-password', method: 'POST' },
      ]);
    } finally {
      await client.close(2000);
    }
  });

  it('sanitizes errors, transactions, individual spans and collected breadcrumbs', () => {
    const options = createServerErrorReportingOptions({
      dsn: 'https://public@example.com/1',
      environment: 'production',
      release: 'test-release',
    });
    expect(options).toMatchObject({
      dsn: 'https://public@example.com/1',
      environment: 'production',
      release: 'test-release',
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      initialScope: { tags: { service: 'api' } },
    });
    expect(
      options.integrations([{ name: 'Redis' }, { name: 'Http' }, { name: 'Postgres' }])
    ).toEqual([{ name: 'Http' }, { name: 'Postgres' }]);
    const event = {
      request: {
        method: 'POST',
        url: '/api/auth/reset-password?token=PRIVATE',
        headers: { Authorization: 'Bearer PRIVATE', Cookie: 'PRIVATE', 'X-Csrf-Token': 'PRIVATE' },
        data: '{"password":"PRIVATE"}',
        query_string: [['token', 'PRIVATE']],
        cookies: { sid: 'PRIVATE' },
      },
      user: { id: '7', email: 'PRIVATE', ip_address: 'PRIVATE', password_hash: 'PRIVATE' },
      breadcrumbs: [
        { category: 'http', data: { url: '/dogrula?token=PRIVATE', status_code: 500 } },
      ],
      spans: [
        {
          description: 'GET https://example.com/dogrula?token=PRIVATE',
          data: { 'url.query': 'token=PRIVATE', 'http.status_code': 500 },
        },
      ],
    };
    for (const hook of ['beforeSend', 'beforeSendTransaction']) {
      const cleaned = options[hook](event, {});
      expect(JSON.stringify(cleaned)).not.toContain('PRIVATE');
      expect(cleaned.request).toEqual({ method: 'POST', url: '/api/auth/reset-password' });
      expect(cleaned.user).toEqual({ id: '7' });
      expect(cleaned.spans[0].data).toEqual({ 'http.status_code': 500 });
    }
    expect(JSON.stringify(options.beforeSendSpan(event.spans[0]))).not.toContain('PRIVATE');
    expect(options.beforeBreadcrumb(event.breadcrumbs[0])).toEqual({
      category: 'http',
      data: { url: '/dogrula', status_code: 500 },
    });
    expect(event.request.url).toContain('PRIVATE');
  });
});
