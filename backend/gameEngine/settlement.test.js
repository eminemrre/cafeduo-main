const { QUIZ_GAME_TYPE } = require('../../shared/gameRegistry');
const {
  finalizeMemoryEngineGame,
  hasAnyAppliedAction,
  settleEngineState,
} = require('./settlement');

const finishedEngine = ({ winner = 'Alice', draw = false } = {}) => ({
  version: 2,
  kind: 'quiz',
  revision: 30,
  phase: 'finished',
  roundIndex: 10,
  totalRounds: 10,
  players: {
    host: { name: 'Alice', score: 120, correct: 9 },
    guest: { name: 'Bob', score: 80, correct: 6 },
  },
  result: {
    winner,
    draw,
    reason: 'rounds_complete',
    scores: { host: 120, guest: 80 },
  },
});

const privateWithAction = () => ({
  version: 2,
  kind: 'quiz',
  questions: [],
  actions: {
    host: { act_1: { status: 'applied' } },
    guest: {},
  },
});

describe('settleEngineState', () => {
  it('transfers once and marks the public result settled', async () => {
    const applySettlement = jest.fn().mockResolvedValue({ transferredPoints: 10 });
    const first = await settleEngineState({
      game: { gameType: QUIZ_GAME_TYPE, points: 10 },
      engineState: finishedEngine(),
      privateState: privateWithAction(),
      applySettlement,
      nowMs: 1_000,
    });

    expect(first).toMatchObject({
      ok: true,
      alreadySettled: false,
      cancelled: false,
      transferredPoints: 10,
    });
    expect(first.engineState.result).toMatchObject({
      settled: true,
      settledAt: new Date(1_000).toISOString(),
      transferredPoints: 10,
    });
    expect(applySettlement).toHaveBeenCalledTimes(1);
    expect(applySettlement).toHaveBeenCalledWith(
      expect.objectContaining({ winnerName: 'Alice', isDraw: false })
    );

    const retry = await settleEngineState({
      game: { gameType: QUIZ_GAME_TYPE, points: 10 },
      engineState: first.engineState,
      privateState: privateWithAction(),
      applySettlement,
      nowMs: 2_000,
    });
    expect(retry).toMatchObject({ ok: true, alreadySettled: true, transferredPoints: 10 });
    expect(applySettlement).toHaveBeenCalledTimes(1);
  });

  it('settles a draw without a winner and keeps the draw flag', async () => {
    const applySettlement = jest.fn().mockResolvedValue({ transferredPoints: 0 });
    const result = await settleEngineState({
      game: { gameType: QUIZ_GAME_TYPE, points: 10 },
      engineState: finishedEngine({ winner: null, draw: true }),
      privateState: privateWithAction(),
      applySettlement,
    });
    expect(applySettlement).toHaveBeenCalledWith(
      expect.objectContaining({ winnerName: null, isDraw: true })
    );
    expect(result.engineState.result).toMatchObject({ winner: null, draw: true });
  });

  it('cancels a match where neither player produced an accepted action', async () => {
    const applySettlement = jest.fn();
    const result = await settleEngineState({
      game: { gameType: QUIZ_GAME_TYPE, points: 10 },
      engineState: finishedEngine({ winner: null, draw: true }),
      privateState: { version: 2, actions: { host: {}, guest: {} } },
      applySettlement,
    });
    expect(result).toMatchObject({ ok: true, cancelled: true, transferredPoints: 0 });
    expect(result.engineState.result).toMatchObject({
      cancelled: true,
      reason: 'abandoned',
      winner: null,
      settled: true,
    });
    expect(applySettlement).not.toHaveBeenCalled();
  });

  it('refuses an unfinished engine state', async () => {
    const applySettlement = jest.fn();
    const result = await settleEngineState({
      game: { gameType: QUIZ_GAME_TYPE },
      engineState: { ...finishedEngine(), phase: 'open' },
      privateState: privateWithAction(),
      applySettlement,
    });
    expect(result).toEqual({ ok: false, code: 'SERVER_RESULT_PENDING' });
    expect(applySettlement).not.toHaveBeenCalled();
  });
});

describe('hasAnyAppliedAction', () => {
  it('only accepts a non-empty per-player ledger', () => {
    expect(hasAnyAppliedAction(null)).toBe(false);
    expect(hasAnyAppliedAction({ actions: {} })).toBe(false);
    expect(hasAnyAppliedAction({ actions: { host: {}, guest: {} } })).toBe(false);
    expect(hasAnyAppliedAction(privateWithAction())).toBe(true);
  });
});

describe('finalizeMemoryEngineGame', () => {
  const makeGame = (engine, privateState) => ({
    id: 4,
    hostName: 'Alice',
    guestName: 'Bob',
    gameType: QUIZ_GAME_TYPE,
    points: 10,
    status: 'active',
    winner: null,
    gameState: { engine },
    gamePrivateState: privateState,
  });

  it('writes the balance once and flags the result', () => {
    const users = [
      { username: 'alice', points: 100, wins: 0, gamesPlayed: 0 },
      { username: 'bob', points: 40, wins: 0, gamesPlayed: 0 },
    ];
    const game = makeGame(finishedEngine(), privateWithAction());

    const first = finalizeMemoryEngineGame({
      game,
      privateState: game.gamePrivateState,
      getMemoryUsers: () => users,
      nowMs: 1_000,
    });
    expect(first).toMatchObject({ changed: true, settled: true, cancelled: false });
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('Alice');
    expect(game.gameState.engine.result).toMatchObject({
      settled: true,
      transferredPoints: 10,
    });
    expect(users[0].points).toBe(110);
    expect(users[1].points).toBe(30);

    const retry = finalizeMemoryEngineGame({
      game,
      privateState: game.gamePrivateState,
      getMemoryUsers: () => users,
      nowMs: 2_000,
    });
    expect(retry).toMatchObject({ changed: false, settled: true });
    expect(users[0].points).toBe(110);
    expect(users[1].points).toBe(30);
  });

  it('cancels without balances when nobody acted', () => {
    const users = [
      { username: 'alice', points: 100, wins: 0, gamesPlayed: 0 },
      { username: 'bob', points: 40, wins: 0, gamesPlayed: 0 },
    ];
    const game = makeGame(finishedEngine({ winner: null, draw: true }), {
      version: 2,
      actions: { host: {}, guest: {} },
    });

    const result = finalizeMemoryEngineGame({
      game,
      privateState: game.gamePrivateState,
      getMemoryUsers: () => users,
    });
    expect(result).toMatchObject({ settled: true, cancelled: true });
    expect(game.gameState.engine.result).toMatchObject({
      cancelled: true,
      reason: 'abandoned',
      transferredPoints: 0,
    });
    expect(users[0]).toMatchObject({ points: 100, gamesPlayed: 0 });
    expect(users[1]).toMatchObject({ points: 40, gamesPlayed: 0 });
  });
});
