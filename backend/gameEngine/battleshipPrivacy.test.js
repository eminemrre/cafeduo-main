/**
 * Amiral Battı privacy: a fleet is only ever visible to its owner.
 *
 * Runs the real engine through the authenticated action endpoint (memory
 * path) and every serializer that feeds HTTP, sockets, the lobby and history.
 */

const { createGameActionHandler } = require('../handlers/game/handlers/gameActionHandler');
const { serializeGameForActor, serializeLobbyGame } = require('./gameView');
const { createEnginePrivateState, startEngineState } = require('./engines');
const { BATTLESHIP_GAME_TYPE } = require('../../shared/gameRegistry');
const { validateLayout } = require('../../shared/battleship');

const HOST_LAYOUT = [
  { cell: 0, dir: 'h' },
  { cell: 16, dir: 'v' },
  { cell: 21, dir: 'h' },
  { cell: 55, dir: 'v' },
];
const GUEST_LAYOUT = [
  { cell: 56, dir: 'h' },
  { cell: 31, dir: 'v' },
  { cell: 18, dir: 'v' },
  { cell: 36, dir: 'h' },
];
const HOST_CELLS = validateLayout(HOST_LAYOUT).ships.flatMap((ship) => ship.cells);
const GUEST_CELLS = validateLayout(GUEST_LAYOUT).ships.flatMap((ship) => ship.cells);

const createMockRes = () => {
  const res = { statusCode: 200, payload: null };
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

const buildGame = () => {
  const privateState = createEnginePrivateState(BATTLESHIP_GAME_TYPE);
  return {
    id: 77,
    hostName: 'Ada',
    guestName: 'Bora',
    gameType: BATTLESHIP_GAME_TYPE,
    points: 20,
    table: 'MASA03',
    status: 'active',
    winner: null,
    gameState: {
      engine: startEngineState({
        gameType: BATTLESHIP_GAME_TYPE,
        privateState,
        hostName: 'Ada',
        guestName: 'Bora',
      }),
    },
    gamePrivateState: privateState,
    createdAt: new Date().toISOString(),
  };
};

const setup = () => {
  const game = buildGame();
  const deps = {
    pool: { connect: jest.fn() },
    isDbConnected: jest.fn(async () => false),
    logger: { error: jest.fn(), warn: jest.fn() },
    getMemoryGames: () => [game],
    getMemoryUsers: () => [],
    emitRealtimeUpdate: jest.fn(),
  };
  const handler = createGameActionHandler(deps);
  let counter = 0;
  const send = async (username, body) => {
    counter += 1;
    const res = createMockRes();
    await handler(
      {
        params: { id: '77' },
        user: { username },
        body: {
          actionId: `privacy_${counter}_action`,
          roundId: game.gameState.engine.round.id,
          ...body,
        },
      },
      res
    );
    return res;
  };
  return { game, deps, send };
};

/** True when the text contains any of the cells as a JSON array member. */
const cellsIn = (value, cells) => {
  const text = JSON.stringify(value);
  return cells.filter((cell) => new RegExp(`[\\[,]${cell}[\\],]`).test(text));
};

describe('Amiral Battı privacy', () => {
  it('returns only the placing actor fleet and never emits a fleet', async () => {
    const { game, deps, send } = setup();
    const placed = await send('Ada', { type: 'place', layout: HOST_LAYOUT });
    expect(placed.statusCode).toBe(200);
    expect(placed.payload.game.actorView.fleet).toEqual(
      validateLayout(HOST_LAYOUT).ships.map(({ size, cells }) => ({ size, cells }))
    );

    // The guest's GET view during placement: no fleet of its own yet, none of the host's.
    const guestView = serializeGameForActor(game, 'Bora');
    expect(guestView.actorView).toBeUndefined();
    expect(cellsIn(guestView, HOST_CELLS)).toEqual([]);
    expect(JSON.stringify(guestView)).not.toMatch(/autoLayouts|fleets|firstTurn|actions/);

    expect(deps.emitRealtimeUpdate).toHaveBeenCalled();
    const emitted = deps.emitRealtimeUpdate.mock.calls;
    expect(JSON.stringify(emitted)).not.toMatch(/fleet|autoLayouts|"cells"/);
  });

  it('shows hits, misses and sunk ships but no unhit ship cell to anyone else', async () => {
    const { game, deps, send } = setup();
    await send('Ada', { type: 'place', layout: HOST_LAYOUT });
    await send('Bora', { type: 'place', layout: GUEST_LAYOUT });
    const turn = () => game.gameState.engine.round.turn;

    // Whoever starts, sink the guest's 2-cell ship (36, 37) from the host side.
    if (turn() === 'guest') await send('Bora', { type: 'fire', cell: 4 });
    expect((await send('Ada', { type: 'fire', cell: 36 })).statusCode).toBe(200);
    await send('Bora', { type: 'fire', cell: 5 });
    expect((await send('Ada', { type: 'fire', cell: 37 })).statusCode).toBe(200);

    const unhitGuest = GUEST_CELLS.filter((cell) => ![36, 37].includes(cell));
    const unhitHost = HOST_CELLS;
    const shared = serializeGameForActor(game);
    expect(shared.gameState.engine.boards.guest.sunk).toEqual([{ size: 2, cells: [36, 37] }]);
    expect(shared.actorView).toBeUndefined();

    const hostView = serializeGameForActor(game, 'Ada');
    const guestView = serializeGameForActor(game, 'Bora');
    // Each side sees its own fleet and not one unhit cell of the other's.
    expect(cellsIn(hostView.gameState, unhitGuest)).toEqual([]);
    expect(cellsIn(hostView.actorView, unhitGuest)).toEqual([]);
    expect(cellsIn(guestView.actorView, HOST_CELLS)).toEqual([]);
    expect(cellsIn(guestView.gameState, unhitHost)).toEqual([]);
    expect(guestView.actorView.fleet.flatMap((ship) => ship.cells).sort((a, b) => a - b)).toEqual(
      [...GUEST_CELLS].sort((a, b) => a - b)
    );

    for (const surface of [
      shared,
      serializeLobbyGame(game),
      ...deps.emitRealtimeUpdate.mock.calls.map((call) => call[1]),
    ]) {
      expect(cellsIn(surface, unhitGuest)).toEqual([]);
      expect(cellsIn(surface, unhitHost)).toEqual([]);
      expect(JSON.stringify(surface)).not.toMatch(/fleet|autoLayouts|firstTurn/);
    }
  });

  it('rejects a forged result and a shot out of turn through the endpoint', async () => {
    const { game, send } = setup();
    await send('Ada', { type: 'place', layout: HOST_LAYOUT });
    await send('Bora', { type: 'place', layout: GUEST_LAYOUT });
    const waiting = game.gameState.engine.round.turn === 'host' ? 'Bora' : 'Ada';
    const outOfTurn = await send(waiting, { type: 'fire', cell: 9 });
    expect(outOfTurn.statusCode).toBe(409);
    expect(outOfTurn.payload.code).toBe('NOT_YOUR_TURN');

    const mover = waiting === 'Ada' ? 'Bora' : 'Ada';
    const forged = await send(mover, {
      type: 'fire',
      cell: 9,
      hit: true,
      winner: mover,
      sunk: [{ size: 4, cells: [0, 1, 2, 3] }],
    });
    expect(forged.statusCode).toBe(200);
    const board = game.gameState.engine.boards[mover === 'Ada' ? 'guest' : 'host'];
    expect(board.shots).toEqual([{ cell: 9, hit: false }]);
    expect(board.sunk).toEqual([]);
    expect(game.gameState.engine.result).toBeNull();
  });
});
