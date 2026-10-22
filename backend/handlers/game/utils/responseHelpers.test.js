const {
  sendGameUpdate,
  sendLobbyUpdate,
  formatGameResponse,
  sendSuccess,
} = require('./responseHelpers');

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

describe('sendGameUpdate', () => {
  it('sends success with game at default 200', () => {
    const res = createMockRes();
    const game = { id: 1, status: 'waiting' };
    sendGameUpdate(res, game);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, game });
  });

  it('honors custom status code', () => {
    const res = createMockRes();
    sendGameUpdate(res, { id: 2 }, 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
  });
});

describe('sendLobbyUpdate', () => {
  it('emits lobby_updated with timestamp and payload', () => {
    const io = { emit: jest.fn() };
    sendLobbyUpdate(io, { cafeId: 7 });
    expect(io.emit).toHaveBeenCalledTimes(1);
    const [event, payload] = io.emit.mock.calls[0];
    expect(event).toBe('lobby_updated');
    expect(payload.type).toBe('lobby_updated');
    expect(payload.cafeId).toBe(7);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
  });

  it('defaults payload to empty object', () => {
    const io = { emit: jest.fn() };
    sendLobbyUpdate(io);
    expect(io.emit).toHaveBeenCalledWith(
      'lobby_updated',
      expect.objectContaining({ type: 'lobby_updated' })
    );
  });

  it('is a no-op when io is missing', () => {
    expect(() => sendLobbyUpdate(null)).not.toThrow();
    expect(() => sendLobbyUpdate({})).not.toThrow();
    expect(() => sendLobbyUpdate({ emit: 'not-a-function' })).not.toThrow();
  });
});

describe('formatGameResponse', () => {
  it('returns null for falsy game', () => {
    expect(formatGameResponse(null)).toBeNull();
    expect(formatGameResponse(undefined)).toBeNull();
  });

  it('maps snake_case db fields', () => {
    const formatted = formatGameResponse({
      id: 5,
      host_name: 'emin',
      guest_name: 'rakip',
      game_type: 'Retro Satranç',
      points: 100,
      table_code: 'MASA08',
      status: 'playing',
      winner: 'emin',
      game_state: { chess: { fen: 'startpos' }, results: { emin: 9 }, resolvedWinner: 'emin' },
      created_at: '2026-08-06T00:00:00Z',
    });
    expect(formatted).toEqual({
      id: 5,
      hostName: 'emin',
      guestName: 'rakip',
      gameType: 'Retro Satranç',
      points: 100,
      table: 'MASA08',
      status: 'playing',
      winner: 'emin',
      gameState: { chess: { fen: 'startpos' }, resolvedWinner: 'emin' },
      createdAt: '2026-08-06T00:00:00Z',
    });
  });

  it('falls back to camelCase fields and defaults', () => {
    const formatted = formatGameResponse({
      id: 1,
      hostName: 'h',
      gameType: 'quiz',
      points: 50,
      status: 'finished',
    });
    expect(formatted.hostName).toBe('h');
    expect(formatted.guestName).toBeUndefined();
    expect(formatted.gameType).toBe('quiz');
    expect(formatted.table).toBeUndefined();
    expect(formatted.winner).toBeNull();
    expect(formatted.gameState).toEqual({});
  });
});

describe('sendSuccess', () => {
  it('sends success with spread data at 200', () => {
    const res = createMockRes();
    sendSuccess(res, { message: 'ok', count: 3 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ success: true, message: 'ok', count: 3 });
  });

  it('defaults data to empty object and honors status code', () => {
    const res = createMockRes();
    sendSuccess(res, {}, 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual({ success: true });
  });
});
