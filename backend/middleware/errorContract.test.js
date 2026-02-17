const {
  ApiError,
  createValidationError,
  notFoundHandler,
  createErrorHandler,
} = require('./errorContract');

const createMockRes = () => {
  const res = {};
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

describe('errorContract middleware', () => {
  it('creates validation error with details', () => {
    const err = createValidationError([{ path: 'body.points', message: 'invalid' }]);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('returns unified response for not found', () => {
    const req = { originalUrl: '/missing', requestId: 'req-1' };
    const res = createMockRes();
    notFoundHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.code).toBe('ROUTE_NOT_FOUND');
    expect(res.payload.message).toBe('Route not found');
    expect(res.payload.requestId).toBe('req-1');
  });

  it('maps api error in global handler', () => {
    const req = { originalUrl: '/api/test', method: 'POST', requestId: 'req-2', ip: '127.0.0.1' };
    const res = createMockRes();
    const logger = { error: jest.fn() };
    const handler = createErrorHandler({ logger });
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Payload invalid',
      details: [{ path: 'body.gameType', message: 'required' }],
    });

    handler(err, req, res, () => {});

    expect(res.statusCode).toBe(422);
    expect(res.payload.code).toBe('VALIDATION_ERROR');
    expect(res.payload.message).toBe('Payload invalid');
    expect(Array.isArray(res.payload.details)).toBe(true);
    expect(logger.error).toHaveBeenCalled();
  });
});
