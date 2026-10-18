const { sendTransitionError } = require('./errorHelpers');

const createMockRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
};

describe('sendTransitionError', () => {
  it('answers with the shared contract and keeps the transition in details', () => {
    const res = createMockRes();
    sendTransitionError(res, {
      message: 'olmaz',
      code: 'bad_status',
      from: 'waiting',
      to: 'playing',
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      code: 'bad_status',
      message: 'olmaz',
      details: { fromStatus: 'waiting', toStatus: 'playing' },
      requestId: null,
      error: 'olmaz',
      status: 409,
    });
  });

  it('falls back to the generic transition error without a result', () => {
    const res = createMockRes();
    sendTransitionError(res, null, 400);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'invalid_transition',
      error: 'Geçersiz durum geçişi.',
      details: null,
    });
  });
});
