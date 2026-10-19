const { mapTransitionError, sendTransitionError } = require('./errorHelpers');

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

describe('mapTransitionError', () => {
  it('maps missing result to generic transition error', () => {
    expect(mapTransitionError(null)).toEqual({
      error: 'Geçersiz durum geçişi.',
      code: 'invalid_transition',
    });
    expect(mapTransitionError(undefined)).toEqual({
      error: 'Geçersiz durum geçişi.',
      code: 'invalid_transition',
    });
  });
  it('maps full transition result with from/to', () => {
    expect(
      mapTransitionError({ message: 'olmaz', code: 'bad_status', from: 'waiting', to: 'playing' })
    ).toEqual({
      error: 'olmaz',
      code: 'bad_status',
      fromStatus: 'waiting',
      toStatus: 'playing',
    });
  });
  it('falls back to defaults for partial results', () => {
    const mapped = mapTransitionError({});
    expect(mapped.error).toBe('Geçersiz durum geçişi.');
    expect(mapped.code).toBe('invalid_transition');
  });
});

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
