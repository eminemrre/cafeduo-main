/**
 * Adam Asmaca privacy: both players solve the same word, so a board's letters
 * are only ever visible to its owner and the word only after its round.
 *
 * Runs the real engine through the authenticated action endpoint (memory
 * path) and every serializer that feeds HTTP, sockets and the lobby.
 */

const { createGameActionHandler } = require('../handlers/game/handlers/gameActionHandler');
const { serializeGameForActor, serializeLobbyGame, sanitizeEngineState } = require('./gameView');
const { createEnginePrivateState, startEngineState } = require('./engines');
const { HANGMAN_GAME_TYPE } = require('../../shared/gameRegistry');

const WORDS = [
  { word: 'kahve', category: 'Yiyecek ve içecek', difficulty: 1 },
  { word: 'kılıç', category: 'Ev ve eşyalar', difficulty: 2 },
  { word: 'üzüm', category: 'Yiyecek ve içecek', difficulty: 3 },
];

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
  const privateState = createEnginePrivateState(HANGMAN_GAME_TYPE);
  privateState.rounds = WORDS.map((entry) => ({ ...entry }));
  const game = {
    id: 88,
    hostName: 'Ada',
    guestName: 'Bora',
    gameType: HANGMAN_GAME_TYPE,
    points: 20,
    table: 'MASA03',
    status: 'active',
    winner: null,
    gameState: {
      engine: startEngineState({
        gameType: HANGMAN_GAME_TYPE,
        privateState,
        hostName: 'Ada',
        guestName: 'Bora',
      }),
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
        params: { id: '88' },
        user: { username },
        body: {
          actionId: `hangman_${counter}_action`,
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

describe('Adam Asmaca privacy', () => {
  it('returns a board only to its owner and never emits the word or any letters', async () => {
    const { game, deps, send } = setup();
    const guessed = await send('Ada', { type: 'guess', letter: 'K' });
    expect(guessed.statusCode).toBe(200);
    expect(guessed.payload.game.actorView.hangman).toMatchObject({
      roundId: 'r1',
      pattern: ['k', null, null, null, null],
      guessed: ['k'],
      wrong: 0,
    });
    expect(guessed.payload.game.gameState.engine.round).toMatchObject({
      length: 5,
      category: 'Yiyecek ve içecek',
      progress: { host: { revealed: 1, wrong: 0 }, guest: { revealed: 0 } },
    });

    // The guest sees the host's progress counts, never the host's letters.
    const guestView = serializeGameForActor(game, 'Bora');
    expect(guestView.actorView.hangman).toMatchObject({ guessed: [], pattern: [null, null, null, null, null] });
    expect(JSON.stringify(guestView.gameState)).not.toMatch(/"k"|kahve/);
    expect(JSON.stringify(serializeLobbyGame(game))).not.toMatch(/kahve|kılıç|üzüm|guessed|pattern/);

    const emitted = JSON.stringify(deps.emitRealtimeUpdate.mock.calls);
    expect(emitted).not.toMatch(/kahve|kılıç|üzüm|guessed|pattern|"k"/);
    expect(JSON.stringify(guessed.payload)).not.toMatch(/kahve|kılıç|üzüm|"rounds"|"boards"/);
  });

  it('never publishes the word while its round is open, even if it leaked into state', () => {
    const { game } = setup();
    game.gameState.engine.round.word = 'kahve';
    expect(JSON.stringify(sanitizeEngineState(game.gameState.engine))).not.toContain('kahve');
    expect(JSON.stringify(serializeGameForActor(game, 'Bora'))).not.toContain('kahve');
  });

  it('shows the word once the round is over', async () => {
    const { game, send } = setup();
    await send('Ada', { type: 'solve', word: 'KAHVE' });
    const done = await send('Bora', { type: 'solve', word: 'kahve' });
    expect(done.statusCode).toBe(200);
    expect(game.gameState.engine.phase).toBe('reveal');
    expect(serializeGameForActor(game, 'Bora').gameState.engine.round).toMatchObject({
      word: 'kahve',
      scoreDelta: { host: expect.any(Number), guest: expect.any(Number) },
    });
  });

  it('rejects an outsider, a non-letter and a forged score', async () => {
    const { game, send } = setup();
    expect((await send('Cem', { type: 'guess', letter: 'a' })).statusCode).toBe(403);
    expect((await send('Ada', { type: 'guess', letter: 'q' })).payload).toMatchObject({
      code: 'INVALID_LETTER',
    });
    const forged = await send('Ada', { type: 'guess', letter: 'a', score: 999, solved: true });
    expect(forged.statusCode).toBe(200);
    expect(game.gameState.engine.round.progress.host).toMatchObject({ solved: false });
    expect(game.gameState.engine.players.host.score).toBe(0);
  });
});
