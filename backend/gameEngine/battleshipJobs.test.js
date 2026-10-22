/** @jest-environment node */

/**
 * Amiral Battı through the deadline job and one-time settlement (memory path).
 */

const { runGameEngineTick } = require('../jobs/gameEngineJobs');
const { applyBattleshipAction } = require('./battleshipEngine');
const { createEnginePrivateState, startEngineState } = require('./engines');
const { BATTLESHIP_GAME_TYPE } = require('../../shared/gameRegistry');
const { MAX_MISSED_TURNS, TURN_MS, randomLayout } = require('../../shared/battleship');

const start = 1_000_000;
const silentLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };

const makeGame = () => {
  const privateState = createEnginePrivateState(BATTLESHIP_GAME_TYPE);
  return {
    id: 'bs1',
    hostName: 'Ada',
    guestName: 'Bora',
    gameType: BATTLESHIP_GAME_TYPE,
    status: 'active',
    points: 30,
    gameState: {
      engine: startEngineState({
        gameType: BATTLESHIP_GAME_TYPE,
        privateState,
        hostName: 'Ada',
        guestName: 'Bora',
        nowMs: start,
      }),
    },
    gamePrivateState: privateState,
  };
};

const place = (game, actorKey, nowMs) => {
  const result = applyBattleshipAction({
    state: game.gameState.engine,
    privateState: game.gamePrivateState,
    actorKey,
    envelope: {
      actionId: `place_${actorKey}_1`,
      roundId: game.gameState.engine.round.id,
      type: 'place',
      layout: randomLayout((max) => Math.floor(Math.random() * max)),
    },
    nowMs,
  });
  expect(result.ok).toBe(true);
  game.gameState = { ...game.gameState, engine: result.state };
  // The action endpoint records a receipt; settlement reads it to tell an
  // abandoned match from a played one.
  game.gamePrivateState = {
    ...result.privateState,
    actions: {
      ...result.privateState.actions,
      [actorKey]: { [`place_${actorKey}_1`]: { status: 'applied' } },
    },
  };
};

const tick = (game, users, nowMs) =>
  runGameEngineTick({
    isDbConnected: async () => false,
    getMemoryGames: () => [game],
    getMemoryUsers: () => users,
    logger: silentLogger,
    nowMs,
  });

describe('Amiral Battı deadline job', () => {
  it('closes a match nobody placed in without paying anyone', async () => {
    const game = makeGame();
    const users = [
      { username: 'Ada', points: 100, gamesPlayed: 0 },
      { username: 'Bora', points: 100, gamesPlayed: 0 },
    ];
    expect(await tick(game, users, start + 60 * 60 * 1000)).toEqual({ processed: 1, failed: 0 });
    expect(game.status).toBe('finished');
    expect(game.gameState.engine.result).toMatchObject({
      cancelled: true,
      reason: 'abandoned',
      settled: true,
    });
    expect(users.map((user) => [user.points, user.gamesPlayed])).toEqual([
      [100, 0],
      [100, 0],
    ]);
  });

  it('forfeits the silent side from persisted deadlines and pays exactly once', async () => {
    const game = makeGame();
    place(game, 'host', start + 1000);
    place(game, 'guest', start + 2000);
    const battleStart = Date.parse(game.gameState.engine.round.startedAt);
    const firstTurn = game.gameState.engine.round.turn;
    const winnerName = firstTurn === 'host' ? 'Bora' : 'Ada';
    const users = [
      { username: 'Ada', points: 100, gamesPlayed: 0, wins: 0 },
      { username: 'Bora', points: 100, gamesPlayed: 0, wins: 0 },
    ];

    await tick(game, users, start + 60 * 60 * 1000);
    expect(game.status).toBe('finished');
    expect(game.winner).toBe(winnerName);
    expect(game.gameState.engine.result).toMatchObject({
      winner: winnerName,
      reason: 'timeout',
      settled: true,
      transferredPoints: 30,
    });
    // The first player's third miss lands on the fifth deadline.
    expect(Date.parse(game.gameState.engine.phaseEndsAt)).toBe(
      battleStart + TURN_MS * (2 * MAX_MISSED_TURNS - 1)
    );
    const pointsAfter = users.map((user) => user.points);
    expect(pointsAfter.sort((a, b) => a - b)).toEqual([70, 130]);

    // A second tick (another instance, a reader, a retry) does not pay again.
    await tick(game, users, start + 2 * 60 * 60 * 1000);
    expect(users.map((user) => user.points).sort((a, b) => a - b)).toEqual([70, 130]);
  });
});
