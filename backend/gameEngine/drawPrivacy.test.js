/**
 * Çiz Bil privacy: the drawer's choices and word reach only the drawer, the
 * word is public only after its round, and no serializer leaks the private
 * rounds. Runs the real engine through the authenticated action endpoint.
 */

const { createGameActionHandler } = require('../handlers/game/handlers/gameActionHandler');
const { serializeGameForActor, serializeLobbyGame, sanitizeEngineState } = require('./gameView');
const { createEnginePrivateState, startEngineState } = require('./engines');
const { DRAW_GAME_TYPE } = require('../../shared/gameRegistry');

const choices = (a, b, c) => [
  { word: a, category: 'Hayvanlar', difficulty: 1 },
  { word: b, category: 'Ulaşım', difficulty: 2 },
  { word: c, category: 'Şehir hayatı', difficulty: 3 },
];
const SECRET = /kedi|fayton|arasta|kuşlar|şilep|sebil/;

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

const setup = () => {
  const privateState = createEnginePrivateState(DRAW_GAME_TYPE);
  privateState.rounds = [
    { drawer: 'host', choices: choices('kedi', 'fayton', 'arasta'), autoPick: 1, hintSeeds: [0, 0.5] },
    { drawer: 'guest', choices: choices('kuşlar', 'şilep', 'sebil'), autoPick: 0, hintSeeds: [0, 0.5] },
    { drawer: 'host', choices: choices('arı', 'kağnı', 'drezin'), autoPick: 0, hintSeeds: [0, 0.5] },
    { drawer: 'guest', choices: choices('fil', 'tekerlek', 'hendek'), autoPick: 0, hintSeeds: [0, 0.5] },
  ];
  const game = {
    id: 77,
    hostName: 'Ada',
    guestName: 'Bora',
    gameType: DRAW_GAME_TYPE,
    points: 20,
    table: 'MASA03',
    status: 'active',
    winner: null,
    gameState: {
      engine: startEngineState({ gameType: DRAW_GAME_TYPE, privateState, hostName: 'Ada', guestName: 'Bora' }),
    },
    gamePrivateState: privateState,
    createdAt: new Date().toISOString(),
  };
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
        body: { actionId: `draw_${counter}_action`, roundId: game.gameState.engine.round.id, ...body },
      },
      res
    );
    return res;
  };
  return { game, deps, send };
};

describe('Çiz Bil privacy', () => {
  it('shows the choices and the word only to the drawer', async () => {
    const { game, deps, send } = setup();
    expect(serializeGameForActor(game, 'Ada').actorView.draw).toEqual({
      roundId: 'r1',
      role: 'drawer',
      choices: [
        { word: 'kedi', difficulty: 1 },
        { word: 'fayton', difficulty: 2 },
        { word: 'arasta', difficulty: 3 },
      ],
    });
    const guestView = serializeGameForActor(game, 'Bora');
    expect(guestView.actorView.draw).toEqual({ roundId: 'r1', role: 'guesser' });
    expect(JSON.stringify(guestView)).not.toMatch(SECRET);

    const picked = await send('Ada', { type: 'pick', optionIndex: 1 });
    expect(picked.statusCode).toBe(200);
    expect(picked.payload.game.actorView.draw).toEqual({ roundId: 'r1', role: 'drawer', word: 'fayton' });
    expect(picked.payload.game.gameState.engine.round).toMatchObject({ length: 6, drawer: 'host' });
    expect(JSON.stringify(picked.payload.game.gameState)).not.toMatch(/fayton|"pick"|choices|hintSeeds/);

    const emitted = JSON.stringify(deps.emitRealtimeUpdate.mock.calls);
    expect(emitted).not.toMatch(SECRET);
    expect(JSON.stringify(serializeGameForActor(game, 'Bora'))).not.toMatch(SECRET);
    expect(JSON.stringify(serializeLobbyGame(game))).not.toMatch(SECRET);
    expect(JSON.stringify(serializeGameForActor(game, null))).not.toMatch(SECRET);
  });

  it('logs wrong guesses for both players and reveals the word only after the round', async () => {
    const { game, send } = setup();
    await send('Ada', { type: 'pick', optionIndex: 1 });
    expect((await send('Ada', { type: 'solve', word: 'fayton' })).payload).toMatchObject({ code: 'NOT_GUESSER' });
    await send('Bora', { type: 'solve', word: 'Araba' });
    expect(serializeGameForActor(game, 'Ada').gameState.engine.round.guesses).toEqual([
      { text: 'araba', close: false },
    ]);
    const solved = await send('Bora', { type: 'solve', word: 'FAYTON' });
    expect(solved.statusCode).toBe(200);
    expect(serializeGameForActor(game, 'Bora').gameState.engine.round).toMatchObject({
      word: 'fayton',
      solved: true,
      scoreDelta: { host: expect.any(Number), guest: expect.any(Number) },
    });
    expect(JSON.stringify(serializeGameForActor(game, 'Bora'))).not.toMatch(/kuşlar|şilep|sebil/);
  });

  it('never publishes the word while choosing or drawing, even if it leaked into state', () => {
    const { game } = setup();
    game.gameState.engine.round.word = 'kedi';
    expect(JSON.stringify(sanitizeEngineState(game.gameState.engine))).not.toContain('kedi');
  });

  it('rejects an outsider and a pick out of range', async () => {
    const { send } = setup();
    expect((await send('Cem', { type: 'pick', optionIndex: 0 })).statusCode).toBe(403);
    expect((await send('Ada', { type: 'pick', optionIndex: 9 })).payload).toMatchObject({ code: 'INVALID_OPTION' });
  });
});
