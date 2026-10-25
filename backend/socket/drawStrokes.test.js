/** @jest-environment node */
const { createDrawStrokeHandler, createTurnCache } = require('./drawStrokes');
const { createRateLimiter, createStrokeStore } = require('../gameEngine/drawStrokes');

const packet = (extra = {}) => ({
  gameId: '77',
  roundId: 'r1',
  ops: [{ t: 'line', id: 1, c: 0, w: 1, p: [[10, 10], [20, 20]] }],
  ...extra,
});

const setup = ({
  username = 'Ada',
  turn = { roundId: 'r1', drawerName: 'ada', open: true },
  rooms = ['77'],
  socketId = 's1',
  limiter = createRateLimiter({ perSecond: 30, now: () => 0 }),
  auth = {},
  clock = () => 0,
} = {}) => {
  const relayed = [];
  const rejected = [];
  const socket = {
    id: socketId,
    username,
    userId: username.toLowerCase(),
    tokenExpiresAt: auth.expiresAt ?? null,
    isSessionRevoked: auth.revoked || (async () => false),
    disconnect: jest.fn(),
    rooms: new Set(['s1', ...rooms]),
    to: jest.fn((room) => ({ emit: (event, payload) => relayed.push({ room, event, payload }) })),
    emit: jest.fn((event, payload) => rejected.push({ event, payload })),
  };
  let current = turn;
  const loadTurn = jest.fn(async () => current);
  const turns = createTurnCache({ loadTurn, ttlMs: 1000, minFreshMs: 250, now: clock });
  const store = createStrokeStore({ redis: null });
  const handle = createDrawStrokeHandler({
    socket,
    turns,
    store,
    limiter,
    logger: { warn: jest.fn() },
    now: clock,
  });
  return { socket, relayed, rejected, store, loadTurn, handle, setTurn: (next) => (current = next) };
};

describe('draw_strokes socket handler', () => {
  it('stores and relays a packet from the drawer to the rest of the room', async () => {
    const { relayed, rejected, store, handle } = setup();
    await handle(packet());
    expect(rejected).toEqual([]);
    expect(relayed).toEqual([
      { room: '77', event: 'draw_strokes', payload: { gameId: '77', roundId: 'r1', ops: packet().ops } },
    ]);
    expect(await store.list('77', 'r1')).toEqual(packet().ops);
  });

  it('refuses the guesser, an outsider, a closed drawing and a stale round', async () => {
    for (const [options, input] of [
      [{ username: 'Bora' }, packet()],
      [{ username: 'Cem', rooms: [] }, packet()],
      [{ turn: { roundId: 'r1', drawerName: 'ada', open: false } }, packet()],
      [{}, packet({ roundId: 'r2' })],
      [{ turn: null }, packet()],
    ]) {
      const { relayed, rejected, store, handle } = setup(options);
      await handle(input);
      expect(relayed).toEqual([]);
      expect(rejected[0]).toMatchObject({ event: 'draw_rejected', payload: { code: expect.any(String) } });
      expect(await store.list('77', input.roundId)).toEqual([]);
    }
  });

  it('rechecks a stale cached turn once before refusing (the pick just landed)', async () => {
    let now = 0;
    const { relayed, loadTurn, handle, setTurn } = setup({
      turn: { roundId: 'r1', drawerName: 'ada', open: false },
      clock: () => now,
    });
    await handle(packet()); // caches the closed turn and refuses
    setTurn({ roundId: 'r1', drawerName: 'ada', open: true });
    now = 300; // fresh reloads are spaced 250 ms apart per game
    await handle(packet());
    expect(relayed).toHaveLength(1);
    // The first refusal needed no second query: the turn had just been loaded.
    expect(loadTurn).toHaveBeenCalledTimes(2);
  });

  it('does not reload the turn for a sender who is not the cached drawer of that round', async () => {
    const { loadTurn, handle } = setup({ username: 'Bora' });
    for (let i = 0; i < 10; i += 1) await handle(packet());
    expect(loadTurn).toHaveBeenCalledTimes(1);
  });

  it('reloads for a new round at most once per 250 ms', async () => {
    let now = 0;
    const { loadTurn, relayed, handle, setTurn } = setup({ username: 'Bora', clock: () => now });
    await handle(packet({ roundId: 'r2' })); // loads r1 by ada; that read is fresh enough
    await handle(packet({ roundId: 'r2' }));
    await handle(packet({ roundId: 'r2' }));
    expect(loadTurn).toHaveBeenCalledTimes(1);
    setTurn({ roundId: 'r2', drawerName: 'bora', open: true });
    now = 300;
    await handle(packet({ roundId: 'r2' }));
    expect(loadTurn).toHaveBeenCalledTimes(2);
    expect(relayed).toHaveLength(1);
  });

  it('shares the packet budget across the sockets of one user', async () => {
    const limiter = createRateLimiter({ perSecond: 30, now: () => 0 });
    const first = setup({ limiter, socketId: 's1' });
    const second = setup({ limiter, socketId: 's2' });
    for (let i = 0; i < 20; i += 1) await first.handle(packet());
    for (let i = 0; i < 20; i += 1) await second.handle(packet());
    expect(first.relayed.length + second.relayed.length).toBe(30);
  });

  it('drops an expired or revoked session and checks revocation at most once a minute', async () => {
    const expired = setup({ auth: { expiresAt: -1 } });
    await expired.handle(packet());
    expect(expired.rejected[0]).toMatchObject({ payload: { code: 'AUTH_EXPIRED' } });
    expect(expired.socket.disconnect).toHaveBeenCalledWith(true);

    let now = 0;
    const revoked = jest.fn(async () => false);
    const live = setup({ auth: { revoked }, clock: () => now });
    await live.handle(packet());
    await live.handle(packet());
    expect(revoked).toHaveBeenCalledTimes(1);
    revoked.mockResolvedValue(true);
    now = 61_000;
    await live.handle(packet());
    expect(live.socket.disconnect).toHaveBeenCalledWith(true);
    expect(live.relayed).toHaveLength(2);
  });

  it('drops a malformed packet and a flood without relaying', async () => {
    const { relayed, rejected, handle } = setup();
    await handle({ gameId: '77', roundId: 'r1', ops: [{ t: 'text', s: 'kedi' }] });
    expect(rejected[0]).toMatchObject({ payload: { code: 'INVALID_STROKES' } });
    for (let i = 0; i < 40; i += 1) await handle(packet());
    // The malformed packet spent one of the 30 tokens too.
    expect(relayed).toHaveLength(29);
  });
});

describe('createTurnCache', () => {
  it('serves a turn for ttlMs, reloads on demand at most every minFreshMs and shares a reload', async () => {
    let now = 0;
    const loadTurn = jest.fn(async () => ({ roundId: 'r1', drawerName: 'ada', open: true }));
    const turns = createTurnCache({ loadTurn, ttlMs: 1000, minFreshMs: 250, now: () => now });
    await turns.get('77');
    await turns.get('77');
    await turns.get('77', { fresh: true });
    expect(loadTurn).toHaveBeenCalledTimes(1);
    now = 300;
    await Promise.all([turns.get('77', { fresh: true }), turns.get('77', { fresh: true })]);
    expect(loadTurn).toHaveBeenCalledTimes(2);
    now = 1500;
    await turns.get('77');
    expect(loadTurn).toHaveBeenCalledTimes(3);
  });
});
