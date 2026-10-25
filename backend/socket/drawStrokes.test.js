/** @jest-environment node */
const { createDrawStrokeHandler, createTurnCache } = require('./drawStrokes');
const { createRateLimiter, createStrokeStore } = require('../gameEngine/drawStrokes');

const packet = (extra = {}) => ({
  gameId: '77',
  roundId: 'r1',
  ops: [{ t: 'line', id: 1, c: 0, w: 1, p: [[10, 10], [20, 20]] }],
  ...extra,
});

const setup = ({ username = 'Ada', turn = { roundId: 'r1', drawerName: 'ada', open: true }, rooms = ['77'] } = {}) => {
  const relayed = [];
  const rejected = [];
  const socket = {
    id: 's1',
    username,
    rooms: new Set(['s1', ...rooms]),
    to: jest.fn((room) => ({ emit: (event, payload) => relayed.push({ room, event, payload }) })),
    emit: jest.fn((event, payload) => rejected.push({ event, payload })),
  };
  let current = turn;
  const loadTurn = jest.fn(async () => current);
  const turns = createTurnCache({ loadTurn, ttlMs: 1000, now: () => 0 });
  const store = createStrokeStore({ redis: null });
  const handle = createDrawStrokeHandler({
    socket,
    turns,
    store,
    limiter: createRateLimiter({ perSecond: 30, now: () => 0 }),
    logger: { warn: jest.fn() },
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
    const { relayed, loadTurn, handle, setTurn } = setup({ turn: { roundId: 'r1', drawerName: 'ada', open: false } });
    await handle(packet()); // caches the closed turn and refuses
    setTurn({ roundId: 'r1', drawerName: 'ada', open: true });
    await handle(packet());
    expect(relayed).toHaveLength(1);
    expect(loadTurn).toHaveBeenCalledTimes(3);
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
  it('serves a turn for ttlMs and reloads on demand', async () => {
    let now = 0;
    const loadTurn = jest.fn(async () => ({ roundId: 'r1', drawerName: 'ada', open: true }));
    const turns = createTurnCache({ loadTurn, ttlMs: 1000, now: () => now });
    await turns.get('77');
    await turns.get('77');
    expect(loadTurn).toHaveBeenCalledTimes(1);
    await turns.get('77', { fresh: true });
    expect(loadTurn).toHaveBeenCalledTimes(2);
    now = 1500;
    await turns.get('77');
    expect(loadTurn).toHaveBeenCalledTimes(3);
  });
});
