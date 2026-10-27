const { sanitizeDiagnosticData } = require('./diagnosticPrivacy');

describe('diagnostic data minimisation', () => {
  it('removes raw Redis/SQL commands and DB span descriptions, including root trace data', () => {
    const data = {
      'db.system': 'redis',
      'db.statement': 'get blacklist:token:SYNTHETIC_JWT',
      'db.query.text': 'EVAL script user-ip:SYNTHETIC_IP',
      'db.operation': 'get',
    };
    const cleaned = sanitizeDiagnosticData({
      contexts: { trace: { op: 'db', description: 'get blacklist:token:SYNTHETIC_JWT', data } },
      spans: [{ op: 'db.redis', description: 'get blacklist:token:SYNTHETIC_JWT', data }],
    });
    expect(JSON.stringify(cleaned)).not.toContain('SYNTHETIC');
    expect(cleaned.spans[0].data).toEqual({ 'db.system': 'redis', 'db.operation': 'get' });
  });

  it('bounds work and output size for highly shared console object graphs', () => {
    let graph = { count: 1 };
    for (let i = 0; i < 12; i += 1) graph = { a: graph, b: graph, c: graph };
    const result = JSON.stringify(sanitizeDiagnosticData({ data: { arguments: [graph] } }));
    expect(result.length).toBeLessThan(50000);
    expect(result).toContain('[Filtered]');
  });

  it('keeps Error/Date summaries, bounds non-plain objects and never invokes getters', () => {
    const input = {
      args: [
        new Error('GET /dogrula?token=PRIVATE failed'),
        new Date('2026-10-27T00:00:00Z'),
        new Map([['token', 'PRIVATE']]),
      ],
    };
    Object.defineProperty(input, 'unsafe', {
      enumerable: true,
      get() {
        throw new Error('Getter must not run');
      },
    });
    expect(sanitizeDiagnosticData(input)).toEqual({
      args: [
        { name: 'Error', message: 'GET /dogrula failed' },
        '2026-10-27T00:00:00.000Z',
        '[Object]',
      ],
      unsafe: '[Filtered]',
    });
  });

  it('does not corrupt code snippets that happen to contain division or ternary operators', () => {
    const snippet = 'const u = a/b?c:d;';
    expect(
      sanitizeDiagnosticData({
        context_line: snippet,
        pre_context: [snippet],
        post_context: [snippet],
      })
    ).toEqual({ context_line: snippet, pre_context: [snippet], post_context: [snippet] });
  });

  it.each([
    ['https://example.com/dogrula?%74oken=PRIVATE#secret', 'https://example.com/dogrula'],
    ['/reset-password?Token=PRIVATE&token=SECOND', '/reset-password'],
    ['//example.com/dogrula#token=PRIVATE', '//example.com/dogrula'],
    ['?token=PRIVATE', ''],
    ['#token=PRIVATE', ''],
    ['relative-page?unknown=PRIVATE', 'relative-page'],
    ['https://user:PRIVATE@example.com/dogrula?token=SECRET', 'https://example.com/dogrula'],
    ['/bad%url?secret=PRIVATE', '/bad%url'],
    ['/dashboard', '/dashboard'],
  ])(
    'keeps the diagnostic path without query, fragment or URL credentials: %s',
    (url, expected) => {
      expect(sanitizeDiagnosticData({ url }).url).toBe(expected);
    }
  );

  it('scrubs nested span attributes, sensitive fields and embedded error URLs', () => {
    const input = {
      description: 'GET https://u:PRIVATE@example.com/dogrula?token=PRIVATE failed',
      data: {
        'http.url': 'https://example.com/dogrula?unknown=PRIVATE',
        'http.target': '/dogrula?token=PRIVATE',
        'url.query': 'token=PRIVATE',
        'url.fragment': 'token=PRIVATE',
        'http.request.header.authorization': 'Bearer PRIVATE',
        accessToken: 'PRIVATE',
        password_hash: 'PRIVATE',
        api_key: 'PRIVATE',
        'http.status_code': 500,
      },
      user: { id: '7', email: 'PRIVATE', ip_address: 'PRIVATE' },
    };
    expect(sanitizeDiagnosticData(input)).toEqual({
      description: 'GET https://example.com/dogrula failed',
      data: {
        'http.url': 'https://example.com/dogrula',
        'http.target': '/dogrula',
        'http.status_code': 500,
      },
      user: { id: '7' },
    });
    expect(input.data.accessToken).toBe('PRIVATE');
  });

  it('bounds cyclic/deep context without dropping the useful error event', () => {
    const extra = { count: 2 };
    extra.self = extra;
    expect(sanitizeDiagnosticData({ message: 'boom', extra })).toEqual({
      message: 'boom',
      extra: { count: 2, self: '[Filtered]' },
    });
    let deep = { url: '/dogrula?token=PRIVATE' };
    for (let i = 0; i < 30; i += 1) deep = { nested: deep };
    expect(JSON.stringify(sanitizeDiagnosticData(deep))).not.toContain('PRIVATE');
  });

  it('does not mistake repeated context for a cycle and preserves primitive values', () => {
    const context = { url: '/api/health?key=PRIVATE' };
    expect(
      sanitizeDiagnosticData({ a: context, b: context, flag: false, number: 0, empty: null })
    ).toEqual({
      a: { url: '/api/health' },
      b: { url: '/api/health' },
      flag: false,
      number: 0,
      empty: null,
    });
  });
});
