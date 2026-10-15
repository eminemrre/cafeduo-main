const { buildApiErrorPayload, sendApiError, sendApiProblem } = require('./routeHelpers');

const createMockRes = () => {
  const res = {};
  res.req = { requestId: 'req-123' };
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.payload = payload;
    return res;
  });
  return res;
};

describe('routeHelpers', () => {
  it('builds unified api error payload with backward-compatible error field', () => {
    const res = createMockRes();
    const payload = buildApiErrorPayload(res, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [{ path: 'body.points', message: 'required' }],
      status: 400,
    });

    expect(payload).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [{ path: 'body.points', message: 'required' }],
      requestId: 'req-123',
      error: 'Invalid request',
      status: 400,
    });
  });

  it('sendApiError writes unified payload to response', () => {
    const res = createMockRes();
    const logger = { error: jest.fn() };
    sendApiError(res, logger, 'unit_test', { code: 'INTERNAL_FAILURE' }, 'İşlem başarısız.', 500);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.payload.code).toBe('INTERNAL_ERROR');
    expect(res.payload.message).toBe('İşlem başarısız.');
    expect(res.payload.error).toBe('İşlem başarısız.');
    expect(res.payload.requestId).toBe('req-123');
  });

  it('keeps database diagnostics and credential-like error text out of responses and helper logs', () => {
    const res = createMockRes(),
      logger = { error: jest.fn() };
    const err = Object.assign(new Error('private connection text'), {
      code: '23502',
      position: '42',
      table: 'internal_table',
      detail: 'private row detail',
      hint: 'internal hint',
    });
    sendApiError(res, logger, 'Profile save error', err, 'Profil kaydedilemedi.');
    expect(res.payload).toMatchObject({
      code: 'INTERNAL_ERROR',
      details: null,
      message: 'Profil kaydedilemedi.',
      requestId: 'req-123',
    });
    expect(JSON.stringify(res.payload)).not.toMatch(/private|23502|internal_table|internal hint/);
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(
      /private connection|private row|internal hint/
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: '23502', requestId: 'req-123' })
    );
  });

  it('sendApiProblem writes unified payload with explicit status/code', () => {
    const res = createMockRes();
    sendApiProblem(res, {
      status: 404,
      code: 'USER_NOT_FOUND',
      message: 'Kullanıcı bulunamadı.',
    });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.payload.code).toBe('USER_NOT_FOUND');
    expect(res.payload.message).toBe('Kullanıcı bulunamadı.');
    expect(res.payload.error).toBe('Kullanıcı bulunamadı.');
  });
});
