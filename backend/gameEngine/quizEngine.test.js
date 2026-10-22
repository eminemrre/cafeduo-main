const {
  QUIZ_QUESTION_SECONDS,
  advanceQuiz,
  applyQuizAction,
  createQuizPrivateState,
  createQuizPublicState,
  startQuizState,
} = require('./quizEngine');

const questions = [
  {
    question: 'Birinci soru?',
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 1,
    category: 'Test',
    level: 'orta',
  },
  {
    question: 'İkinci soru?',
    options: ['E', 'F', 'G', 'H'],
    answerIndex: 2,
    category: 'Test',
    level: 'zor',
  },
];

const makePrivate = () => ({
  version: 2,
  kind: 'quiz',
  questions,
  responses: {},
  jokers: { host: null, guest: null },
  actions: { host: {}, guest: {} },
});

const makeGame = (nowMs = 0) => {
  const privateState = makePrivate();
  const state = startQuizState({
    state: createQuizPublicState({ hostName: 'Alice', guestName: 'Bob', totalRounds: 2 }),
    privateState,
    hostName: 'Alice',
    guestName: 'Bob',
    nowMs,
  });
  return { state, privateState };
};

const answer = (roundId, actorKey, optionIndex, nowMs, state, privateState) =>
  applyQuizAction({
    state,
    privateState,
    actorKey,
    envelope: {
      actionId: `act_${actorKey}_${nowMs}`,
      roundId,
      type: 'answer',
      optionIndex,
    },
    nowMs,
  });

describe('quizEngine', () => {
  it('builds a private question set with answer keys outside the public state', () => {
    const privateState = createQuizPrivateState();
    expect(privateState.questions).toHaveLength(10);
    for (const question of privateState.questions) {
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.options[question.answerIndex]).toBeTruthy();
    }

    const { state } = makeGame();
    expect(state.players.host.name).toBe('Alice');
    expect(state.players.guest.name).toBe('Bob');
    expect(state.phase).toBe('open');
    expect(state.round).not.toHaveProperty('answerIndex');
    expect(state.round.question).toBe('Birinci soru?');
    expect(state.phaseEndsAt).toBe(new Date(QUIZ_QUESTION_SECONDS * 1000).toISOString());
  });

  it('scores at server receive time and reveals only after both answers', () => {
    const { state, privateState } = makeGame();
    const host = answer('r1', 'host', 1, 5000, state, privateState);
    expect(host.ok).toBe(true);
    expect(host.state.phase).toBe('open');
    expect(host.state.players.host.score).toBe(0);
    expect(host.privateState.responses.r1.host.points).toBe(20);
    expect(host.privateState.responses.r1.host.secondsLeft).toBe(10);
    expect(host.state.round.correctIndex).toBeUndefined();

    const guest = answer('r1', 'guest', 0, 7000, host.state, host.privateState);
    expect(guest.ok).toBe(true);
    expect(guest.state.phase).toBe('reveal');
    expect(guest.state.players.host.score).toBe(20);
    expect(guest.state.players.guest.score).toBe(0);
    expect(guest.state.players.guest.streak).toBe(0);
    expect(guest.state.round.correctIndex).toBe(1);
    expect(guest.state.round.picks).toEqual({ host: 1, guest: 0 });
    expect(guest.state.round.scoreDelta).toEqual({ host: 20, guest: 0 });
    expect(guest.state.phaseEndsAt).toBe(new Date(7000 + 900).toISOString());
  });

  it('closes a round on the deadline, then opens the next one after the reveal', () => {
    const { state, privateState } = makeGame();
    const closed = advanceQuiz(state, privateState, QUIZ_QUESTION_SECONDS * 1000);
    expect(closed.changed).toBe(true);
    expect(closed.state.phase).toBe('reveal');
    expect(closed.state.round.picks).toEqual({ host: null, guest: null });
    expect(closed.state.players.host.streak).toBe(0);

    const next = advanceQuiz(closed.state, privateState, QUIZ_QUESTION_SECONDS * 1000 + 900);
    expect(next.changed).toBe(true);
    expect(next.state.phase).toBe('open');
    expect(next.state.roundIndex).toBe(2);
    expect(next.state.round.id).toBe('r2');
    expect(next.state.players.host.answered).toBe(false);
  });

  it('doubles the final question and finishes with a draw on equal scores', () => {
    const { state, privateState } = makeGame();
    const host = answer('r1', 'host', 1, 0, state, privateState);
    const guest = answer('r1', 'guest', 1, 0, host.state, host.privateState);
    const round2 = advanceQuiz(guest.state, privateState, 900).state;

    const host2 = answer('r2', 'host', 2, 900, round2, privateState);
    expect(host2.privateState.responses.r2.host.points).toBe(2 * (10 + 15));
    const guest2 = answer('r2', 'guest', 2, 900, host2.state, host2.privateState);
    expect(guest2.state.phase).toBe('reveal');

    const finished = advanceQuiz(guest2.state, privateState, 1800);
    expect(finished.state.phase).toBe('finished');
    expect(finished.state.result).toEqual({
      winner: null,
      draw: true,
      reason: 'rounds_complete',
      scores: { host: 75, guest: 75 },
    });
  });

  it('rejects stale, closed, duplicate and out-of-range answers', () => {
    const { state, privateState } = makeGame();
    const stale = answer('r2', 'host', 1, 100, state, privateState);
    expect(stale).toMatchObject({ ok: false, code: 'STALE_ROUND' });

    const first = answer('r1', 'host', 1, 100, state, privateState);
    const again = answer('r1', 'host', 2, 200, first.state, first.privateState);
    expect(again).toMatchObject({ ok: false, code: 'ALREADY_ANSWERED' });

    const badOption = answer('r1', 'guest', 9, 300, state, privateState);
    expect(badOption).toMatchObject({ ok: false, code: 'INVALID_OPTION' });

    const guest = answer('r1', 'guest', 1, 400, first.state, first.privateState);
    const closed = answer('r1', 'guest', 1, 500, guest.state, guest.privateState);
    expect(closed).toMatchObject({ ok: false, code: 'ROUND_CLOSED' });
  });

  it('uses the same half-and-half pair for both players and once per match', () => {
    const { state, privateState } = makeGame();
    const hostJoker = applyQuizAction({
      state,
      privateState,
      actorKey: 'host',
      envelope: { actionId: 'act_joker_host', roundId: 'r1', type: 'joker' },
      nowMs: 1000,
    });
    expect(hostJoker.ok).toBe(true);
    expect(hostJoker.state.round.hiddenOptions).toBeUndefined();
    const hidden = hostJoker.privateState.jokers.host.hidden;
    expect(hidden).toHaveLength(2);
    expect(hidden).not.toContain(1);

    const guestJoker = applyQuizAction({
      state: hostJoker.state,
      privateState: hostJoker.privateState,
      actorKey: 'guest',
      envelope: { actionId: 'act_joker_guest', roundId: 'r1', type: 'joker' },
      nowMs: 2000,
    });
    expect(guestJoker.state.round.hiddenOptions).toBeUndefined();
    expect(guestJoker.privateState.jokers.guest.hidden).toEqual(hidden);

    const twice = applyQuizAction({
      state: guestJoker.state,
      privateState: guestJoker.privateState,
      actorKey: 'host',
      envelope: { actionId: 'act_joker_host2', roundId: 'r1', type: 'joker' },
      nowMs: 3000,
    });
    expect(twice).toMatchObject({ ok: false, code: 'JOKER_USED' });
  });

  it('finishes on resign with the opponent as winner', () => {
    const { state, privateState } = makeGame();
    const resigned = applyQuizAction({
      state,
      privateState,
      actorKey: 'host',
      envelope: { actionId: 'act_resign_1', roundId: 'r1', type: 'resign' },
      nowMs: 1000,
    });
    expect(resigned.ok).toBe(true);
    expect(resigned.state.phase).toBe('finished');
    expect(resigned.state.result).toEqual({
      winner: 'Bob',
      draw: false,
      reason: 'resign',
      scores: { host: 0, guest: 0 },
    });
  });

  it('does not mutate the arguments', () => {
    const { state, privateState } = makeGame();
    const snapshot = JSON.stringify({ state, privateState });
    answer('r1', 'host', 1, 1000, state, privateState);
    expect(JSON.stringify({ state, privateState })).toBe(snapshot);
  });
});
