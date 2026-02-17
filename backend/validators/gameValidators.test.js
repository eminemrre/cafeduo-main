const {
  validateGameIdParam,
  validateCreateGamePayload,
  validateJoinGamePayload,
  validateMovePayload,
} = require('./gameValidators');

const runMiddleware = async (middleware, req) =>
  new Promise((resolve) => {
    middleware(req, {}, (err) => resolve(err || null));
  });

describe('gameValidators', () => {
  describe('validateGameIdParam', () => {
    it('accepts positive integer id', async () => {
      const err = await runMiddleware(validateGameIdParam, { params: { id: '42' } });
      expect(err).toBeNull();
    });

    it('rejects invalid id', async () => {
      const err = await runMiddleware(validateGameIdParam, { params: { id: 'abc' } });
      expect(err).toBeTruthy();
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('validateCreateGamePayload', () => {
    it('accepts valid payload', async () => {
      const err = await runMiddleware(validateCreateGamePayload, {
        body: { gameType: 'Retro Satranç', points: 120, table: 'MASA03' },
      });
      expect(err).toBeNull();
    });

    it('rejects invalid payload', async () => {
      const err = await runMiddleware(validateCreateGamePayload, {
        body: { gameType: '', points: -3 },
      });
      expect(err).toBeTruthy();
      expect(err.status).toBe(400);
      expect(Array.isArray(err.details)).toBe(true);
      expect(err.details.length).toBeGreaterThan(0);
    });
  });

  describe('validateJoinGamePayload', () => {
    it('accepts valid join payload', async () => {
      const err = await runMiddleware(validateJoinGamePayload, {
        params: { id: '9' },
        body: {},
      });
      expect(err).toBeNull();
    });

    it('rejects invalid join payload', async () => {
      const err = await runMiddleware(validateJoinGamePayload, {
        params: { id: '0' },
        body: { guestName: '' },
      });
      expect(err).toBeTruthy();
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('validateMovePayload', () => {
    it('accepts valid chess move payload', async () => {
      const err = await runMiddleware(validateMovePayload, {
        params: { id: '15' },
        body: { chessMove: { from: 'e2', to: 'e4' } },
      });
      expect(err).toBeNull();
    });

    it('rejects multiple move payloads in same request', async () => {
      const err = await runMiddleware(validateMovePayload, {
        params: { id: '15' },
        body: {
          chessMove: { from: 'e2', to: 'e4' },
          liveSubmission: { done: true, score: 10 },
        },
      });
      expect(err).toBeTruthy();
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('rejects malformed chess coordinates', async () => {
      const err = await runMiddleware(validateMovePayload, {
        params: { id: '15' },
        body: {
          chessMove: { from: 'z9', to: 'e4' },
        },
      });
      expect(err).toBeTruthy();
      expect(err.status).toBe(400);
    });
  });
});
