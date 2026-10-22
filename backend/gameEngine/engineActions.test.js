const {
  processCompetitiveAction,
  resolveActorKey,
  syncCompetitiveGame,
} = require('./engineActions');
const { createQuizPrivateState, createQuizPublicState, startQuizState } = require('./quizEngine');
const { QUIZ_GAME_TYPE } = require('../../shared/gameRegistry');

const buildGame = (nowMs = Date.now()) => {
  const privateState = createQuizPrivateState();
  const state = startQuizState({
    state: createQuizPublicState({
      hostName: 'Alice',
      guestName: 'Bob',
      totalRounds: privateState.questions.length,
    }),
    privateState,
    hostName: 'Alice',
    guestName: 'Bob',
    nowMs,
  });
  return {
    id: 1,
    hostName: 'Alice',
    guestName: 'Bob',
    gameType: QUIZ_GAME_TYPE,
    status: 'active',
    winner: null,
    gameState: { engine: state },
    gamePrivateState: privateState,
  };
};

const envelope = (overrides = {}) => ({
  actionId: 'act_engine_1',
  roundId: 'r1',
  type: 'answer',
  optionIndex: 0,
  ...overrides,
});

describe('processCompetitiveAction', () => {
  it('resolves the actor and applies an action', () => {
    expect(resolveActorKey('alice', buildGame())).toBe('host');
    expect(resolveActorKey('BOB', buildGame())).toBe('guest');
    expect(resolveActorKey('mallory', buildGame())).toBeNull();

    const game = buildGame();
    const result = processCompetitiveAction({
      game,
      actorName: 'Alice',
      envelope: envelope(),
      nowMs: Date.now(),
    });
    expect(result.ok).toBe(true);
    expect(result.actorKey).toBe('host');
    expect(result.state.players.host.answered).toBe(true);
    expect(result.privateState.responses.r1.host).toBeDefined();
    expect(result.privateState.actions.host.act_engine_1).toBeDefined();
    expect(result.status).toBe('active');
  });

  it('returns a duplicate for an exact retry and a conflict for a changed body', () => {
    const first = processCompetitiveAction({
      game: buildGame(),
      actorName: 'Alice',
      envelope: envelope(),
      nowMs: Date.now(),
    });
    const game = {
      ...buildGame(),
      gameState: { engine: first.state },
      gamePrivateState: first.privateState,
    };

    const retry = processCompetitiveAction({
      game,
      actorName: 'Alice',
      envelope: envelope(),
      nowMs: Date.now(),
    });
    expect(retry).toMatchObject({ ok: true, duplicate: true });
    expect(retry.state.revision).toBe(first.state.revision);

    const conflict = processCompetitiveAction({
      game,
      actorName: 'Alice',
      envelope: envelope({ optionIndex: 1 }),
      nowMs: Date.now(),
    });
    expect(conflict).toMatchObject({ ok: false, code: 'ACTION_ID_CONFLICT' });
  });

  it('rejects an outsider even when the caller is an admin', () => {
    const result = processCompetitiveAction({
      game: buildGame(),
      actorName: 'root',
      envelope: envelope(),
      nowMs: Date.now(),
    });
    expect(result).toMatchObject({ ok: false, status: 403, code: 'NOT_PARTICIPANT' });
  });

  it('refuses a game without server private state', () => {
    const game = buildGame();
    delete game.gamePrivateState;
    const result = processCompetitiveAction({
      game,
      actorName: 'Alice',
      envelope: envelope(),
      nowMs: Date.now(),
    });
    expect(result).toMatchObject({ ok: false, status: 409, code: 'ENGINE_STATE_MISSING' });
  });

  it('reports the finished status and winner when the last score is applied', () => {
    const game = buildGame();
    game.gameState.engine.phase = 'reveal';
    game.gameState.engine.roundIndex = 10;
    game.gameState.engine.phaseEndsAt = new Date(Date.now() - 1).toISOString();
    game.gamePrivateState.questions = new Array(10).fill(null).map((_item, index) => ({
      question: `q${index}`,
      options: ['a', 'b', 'c', 'd'],
      answerIndex: 0,
      category: 'Test',
      level: 'orta',
    }));
    game.gameState.engine.totalRounds = 10;
    game.gameState.engine.players.host.score = 10;
    game.gameState.engine.players.guest.score = 5;

    const sync = syncCompetitiveGame({ game, nowMs: Date.now() });
    expect(sync.changed).toBe(true);
    expect(sync.state.phase).toBe('finished');
    expect(sync.status).toBe('finished');
    expect(sync.winner).toBe('Alice');
  });
});

describe('syncCompetitiveGame', () => {
  it('does nothing for a waiting or legacy game', () => {
    const game = buildGame();
    game.gameState.engine.phase = 'finished';
    expect(syncCompetitiveGame({ game, nowMs: Date.now() }).changed).toBe(false);

    game.gameState = {};
    expect(syncCompetitiveGame({ game, nowMs: Date.now() }).changed).toBe(false);
  });
});
