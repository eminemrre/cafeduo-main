/** @jest-environment node */
const quiz = require('./quizEngine');
const aim = require('./aimEngine');
const { serializeGameForActor } = require('./gameView');
const { runGameEngineTick } = require('../jobs/gameEngineJobs');

const start = 100000;
const makeGame = (kind) => {
  const engine = kind === 'quiz' ? quiz : aim;
  const privateState =
    kind === 'quiz'
      ? quiz.createQuizPrivateState({ randomInt: () => 0 })
      : aim.createAimPrivateState({ randomInt: () => 0 });
  const state = (kind === 'quiz' ? quiz.startQuizState : aim.startAimState)({
    state: (kind === 'quiz' ? quiz.createQuizPublicState : aim.createAimPublicState)({
      hostName: 'Alice',
      guestName: 'Bob',
    }),
    privateState,
    hostName: 'Alice',
    guestName: 'Bob',
    nowMs: start,
  });
  return { engine, state, privateState };
};

describe('independent review regressions', () => {
  for (const kind of ['quiz', 'aim']) {
    const advance = kind === 'quiz' ? quiz.advanceQuiz : aim.advanceAim;
    const duration = kind === 'quiz' ? 15000 : 8000;
    const reveal = kind === 'quiz' ? 900 : 750;
    const count = kind === 'quiz' ? 10 : 5;

    it(`${kind}: catches up all missed rounds using persisted deadlines after restart`, () => {
      const { state, privateState } = makeGame(kind);
      const result = advance(JSON.parse(JSON.stringify(state)), privateState, start + 3600000);
      expect(result.state.phase).toBe('finished');
      expect(result.state.roundIndex).toBe(count);
      expect(Date.parse(result.state.phaseEndsAt)).toBe(start + count * (duration + reveal));
      expect(result.state.result.scores).toEqual({ host: 0, guest: 0 });
      expect(advance(result.state, privateState, start + 3600001).changed).toBe(false);
    });

    it(`${kind}: reconnect cannot reset the next round deadline`, () => {
      const { state, privateState } = makeGame(kind);
      const late = start + duration + reveal + 2000;
      const result = advance(state, privateState, late);
      expect(result.state.round.id).toBe('r2');
      expect(Date.parse(result.state.round.startedAt)).toBe(start + duration + reveal);
      expect(Date.parse(result.state.round.endsAt)).toBe(start + 2 * duration + reveal);
      expect(advance(result.state, privateState, late + 1).state.round.endsAt).toBe(
        result.state.round.endsAt
      );
    });

    it(`${kind}: catch-up counts the accepted action once and missed rounds as zero`, () => {
      const { state, privateState } = makeGame(kind);
      const apply = kind === 'quiz' ? quiz.applyQuizAction : aim.applyAimAction;
      const accepted = apply({
        state,
        privateState,
        actorKey: 'host',
        envelope: {
          actionId: 'partial_action_1',
          roundId: 'r1',
          type: kind === 'quiz' ? 'answer' : 'fire',
          optionIndex: privateState.questions?.[0].answerIndex,
        },
        nowMs: start + 1000,
      });
      const points =
        kind === 'quiz'
          ? accepted.privateState.responses.r1.host.points
          : accepted.privateState.shots.r1.host.points;
      const result = advance(accepted.state, accepted.privateState, start + 3600000);
      expect(result.state.phase).toBe('finished');
      expect(result.state.players.host.score).toBe(points);
      expect(result.state.players.guest.score).toBe(0);
      expect(
        advance(result.state, accepted.privateState, start + 3600001).state.players.host.score
      ).toBe(points);
    });

    it(`${kind}: early reveal is anchored to the latest accepted receive time, not processing order`, () => {
      const { state, privateState } = makeGame(kind);
      const apply = kind === 'quiz' ? quiz.applyQuizAction : aim.applyAimAction;
      const first = apply({
        state,
        privateState,
        actorKey: 'host',
        envelope: {
          actionId: 'late_first_action',
          roundId: 'r1',
          type: kind === 'quiz' ? 'answer' : 'fire',
          optionIndex: 0,
        },
        nowMs: start + 3000,
      });
      const second = apply({
        state: first.state,
        privateState: first.privateState,
        actorKey: 'guest',
        envelope: {
          actionId: 'early_second_action',
          roundId: 'r1',
          type: kind === 'quiz' ? 'answer' : 'fire',
          optionIndex: 0,
        },
        nowMs: start + 1000,
      });
      expect(second.state.phaseEndsAt).toBe(new Date(start + 3000 + reveal).toISOString());
    });

    it(`${kind}: never reopens a worker-closed round or credits an old timestamp to a future round`, () => {
      const { state, privateState } = makeGame(kind);
      const apply = kind === 'quiz' ? quiz.applyQuizAction : aim.applyAimAction;
      const advanced = advance(state, privateState, start + duration + reveal).state;
      const envelope = {
        actionId: 'queued_old_action',
        roundId: 'r1',
        type: kind === 'quiz' ? 'answer' : 'fire',
        optionIndex: 0,
      };
      expect(
        apply({ state: advanced, privateState, actorKey: 'host', envelope, nowMs: start + 1000 })
      ).toMatchObject({ ok: false, code: 'STALE_ROUND' });
      expect(
        apply({
          state: advanced,
          privateState,
          actorKey: 'host',
          envelope: { ...envelope, roundId: 'r2' },
          nowMs: start + 1000,
        })
      ).toMatchObject({ ok: false, code: 'ACTION_BEFORE_ROUND' });
      expect(advanced.players.host.score).toBe(0);
    });

    it(`${kind}: background job finishes disconnected memory players without paying`, async () => {
      const { state, privateState } = makeGame(kind);
      const game = {
        id: kind,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: kind === 'quiz' ? 'Bilgi Yarışı' : 'Nişancı Düellosu',
        status: 'active',
        points: 10,
        gameState: { engine: state },
        gamePrivateState: privateState,
      };
      const users = [
        { username: 'Alice', points: 100, gamesPlayed: 0 },
        { username: 'Bob', points: 100, gamesPlayed: 0 },
      ];
      const result = await runGameEngineTick({
        isDbConnected: async () => false,
        getMemoryGames: () => [game],
        getMemoryUsers: () => users,
        logger: console,
        nowMs: start + 3600000,
      });
      expect(result).toEqual({ processed: 1, failed: 0 });
      expect(game.status).toBe('finished');
      expect(game.gameState.engine.result).toMatchObject({
        cancelled: true,
        reason: 'abandoned',
        settled: true,
      });
      expect(users.map((u) => u.points)).toEqual([100, 100]);
    });
  }

  it('keeps joker choices out of public state and projects only the authenticated actor', () => {
    const { state, privateState } = makeGame('quiz');
    const applied = quiz.applyQuizAction({
      state,
      privateState,
      actorKey: 'host',
      envelope: { actionId: 'joker_test_1', roundId: 'r1', type: 'joker' },
      nowMs: start + 100,
    });
    expect(applied.state.round.hiddenOptions).toBeUndefined();
    const game = {
      hostName: 'Alice',
      guestName: 'Bob',
      gameType: 'Bilgi Yarışı',
      gameState: { engine: applied.state },
      gamePrivateState: applied.privateState,
    };
    expect(JSON.stringify(serializeGameForActor(game))).not.toContain('hiddenOptions');
    expect(JSON.stringify(serializeGameForActor(game, 'Bob'))).not.toContain('hiddenOptions');
    expect(JSON.stringify(serializeGameForActor(game, 'Mallory'))).not.toContain('hiddenOptions');
    expect(serializeGameForActor(game, 'Alice').actorView.joker).toEqual({
      roundId: 'r1',
      hiddenOptions: applied.privateState.jokers.host.hidden,
    });
    expect(applied.state.players.guest.jokerUsed).toBe(false);
    const guest = quiz.applyQuizAction({
      state: applied.state,
      privateState: applied.privateState,
      actorKey: 'guest',
      envelope: { actionId: 'joker_test_2', roundId: 'r1', type: 'joker' },
      nowMs: start + 200,
    });
    expect(guest.privateState.jokers.guest.hidden).toEqual(applied.privateState.jokers.host.hidden);
    expect(guest.state.players.guest.jokerUsed).toBe(true);
  });
});
