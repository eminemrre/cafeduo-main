/** @jest-environment node */
const {
  HANGMAN_MAX_WRONG,
  HANGMAN_REVEAL_MS,
  HANGMAN_ROUND_COUNT,
  HANGMAN_ROUND_MS,
  actorBoard,
  advanceHangman,
  applyHangmanAction,
  createHangmanPrivateState,
  createHangmanPublicState,
  startHangmanState,
} = require('./hangmanEngine');
const words = require('./data/words.json');

const ROUNDS = [
  { word: 'kahve', category: 'Yiyecek ve içecek', difficulty: 1 },
  { word: 'kılıç', category: 'Ev ve eşyalar', difficulty: 2 },
  { word: 'üzüm', category: 'Yiyecek ve içecek', difficulty: 3 },
];

const newGame = (nowMs = 1_000_000) => {
  const privateState = createHangmanPrivateState({ randomInt: () => 0 });
  privateState.rounds = ROUNDS.map((round) => ({ ...round }));
  const state = startHangmanState({
    state: createHangmanPublicState({ hostName: 'Ada', guestName: 'Bora', totalRounds: 3 }),
    privateState,
    hostName: 'Ada',
    guestName: 'Bora',
    nowMs,
  });
  return { state, privateState, now: nowMs };
};

let counter = 0;
const act = (game, actorKey, type, extra = {}, nowMs = game.now) => {
  counter += 1;
  const result = applyHangmanAction({
    state: game.state,
    privateState: game.privateState,
    actorKey,
    envelope: {
      actionId: `act_${actorKey}_${counter}`,
      roundId: extra.roundId || game.state.round?.id,
      type,
      ...extra,
    },
    nowMs,
  });
  if (result.ok) {
    game.state = result.state;
    game.privateState = result.privateState;
  }
  return result;
};

const json = (value) => JSON.stringify(value);

describe('hangmanEngine', () => {
  it('picks one word per difficulty, each from a different category of the bank', () => {
    let seed = 7;
    const privateState = createHangmanPrivateState({
      randomInt: (max) => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % max;
      },
    });
    expect(privateState.rounds).toHaveLength(HANGMAN_ROUND_COUNT);
    expect(privateState.rounds.map((round) => round.difficulty)).toEqual([1, 2, 3]);
    expect(new Set(privateState.rounds.map((round) => round.category)).size).toBe(3);
    for (const round of privateState.rounds) {
      expect(words).toContainEqual(round);
    }
  });

  it('opens a 60 s round that shows the length and category but never the word', () => {
    const game = newGame();
    expect(game.state.phase).toBe('open');
    expect(game.state.round).toMatchObject({
      id: 'r1',
      length: 5,
      category: 'Yiyecek ve içecek',
      difficulty: 1,
      maxWrong: HANGMAN_MAX_WRONG,
      progress: {
        host: { revealed: 0, wrong: 0, solved: false, done: false },
        guest: { revealed: 0, wrong: 0, solved: false, done: false },
      },
    });
    expect(Date.parse(game.state.round.endsAt) - game.now).toBe(HANGMAN_ROUND_MS);
    expect(json(game.state)).not.toMatch(/kahve|kılıç|üzüm/);
  });

  it('reveals every position of a right letter only on the guesser board', () => {
    const game = newGame();
    expect(act(game, 'host', 'guess', { letter: 'k' }).ok).toBe(true);
    expect(actorBoard(game.state, game.privateState, 'host')).toMatchObject({
      pattern: ['k', null, null, null, null],
      guessed: ['k'],
      wrong: 0,
    });
    expect(actorBoard(game.state, game.privateState, 'guest').pattern).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(game.state.round.progress.host).toMatchObject({ revealed: 1, wrong: 0 });
    expect(json(game.state)).not.toContain('kahve');
    expect(act(game, 'host', 'guess', { letter: 'k' })).toMatchObject({
      ok: false,
      status: 409,
      code: 'ALREADY_GUESSED',
    });
  });

  it('keeps ı and i apart', () => {
    const game = newGame();
    // Close round 1 so r2 ("kılıç") is open.
    game.state = advanceHangman(
      game.state,
      game.privateState,
      Date.parse(game.state.round.endsAt) + HANGMAN_REVEAL_MS
    ).state;
    expect(game.state.round.id).toBe('r2');
    game.now = Date.parse(game.state.round.startedAt);
    act(game, 'host', 'guess', { letter: 'i' });
    expect(actorBoard(game.state, game.privateState, 'host')).toMatchObject({ wrong: 1 });
    act(game, 'host', 'guess', { letter: 'ı' });
    expect(actorBoard(game.state, game.privateState, 'host').pattern).toEqual([
      null,
      'ı',
      null,
      'ı',
      null,
    ]);
  });

  it('ends a board after six wrong letters and refuses further guesses', () => {
    const game = newGame();
    for (const letter of ['b', 'c', 'd', 'f', 'g', 'i']) act(game, 'guest', 'guess', { letter });
    expect(game.state.round.progress.guest).toMatchObject({ wrong: 6, solved: false, done: true });
    expect(act(game, 'guest', 'guess', { letter: 'k' })).toMatchObject({
      ok: false,
      status: 409,
      code: 'BOARD_DONE',
    });
  });

  it('solves with the whole word, costs two lives for a wrong word, and scores time and lives', () => {
    const game = newGame();
    act(game, 'host', 'guess', { letter: 'z' }); // one wrong
    expect(act(game, 'host', 'solve', { word: 'kahva' }).ok).toBe(true);
    expect(game.state.round.progress.host).toMatchObject({ wrong: 3, solved: false, done: false });
    // 12 s in: 48 s left → 10 + 3 lives × 2 + floor(48 / 6) = 24
    expect(act(game, 'host', 'solve', { word: 'kahve' }, game.now + 12_000).ok).toBe(true);
    expect(game.state.round.progress.host).toMatchObject({ solved: true, done: true, revealed: 5 });
    expect(actorBoard(game.state, game.privateState, 'host')).toMatchObject({ points: 24 });
  });

  it('closes the round when both boards are done, reveals the word and opens the next round', () => {
    const game = newGame();
    act(game, 'host', 'solve', { word: 'kahve' }, game.now + 6_000);
    for (const letter of ['b', 'c', 'd', 'f', 'g', 'i']) {
      act(game, 'guest', 'guess', { letter }, game.now + 9_000);
    }
    expect(game.state.phase).toBe('reveal');
    // Solved at 6 s with all six lives: 10 + 6 × 2 + floor(54 / 6) = 31.
    expect(game.state.round).toMatchObject({ word: 'kahve', scoreDelta: { host: 31, guest: 0 } });
    expect(game.state.players.host.score).toBe(31);
    expect(game.state.phaseEndsAt).toBe(new Date(game.now + 9_000 + HANGMAN_REVEAL_MS).toISOString());
    const next = advanceHangman(game.state, game.privateState, game.now + 9_000 + HANGMAN_REVEAL_MS);
    expect(next.state.round).toMatchObject({ id: 'r2', length: 5 });
    expect(json(next.state)).not.toMatch(/kılıç|üzüm/);
  });

  it('scores an unsolved board by the letters it opened when time runs out', () => {
    const game = newGame();
    act(game, 'host', 'guess', { letter: 'a' });
    act(game, 'host', 'guess', { letter: 'e' });
    const { state } = advanceHangman(game.state, game.privateState, Date.parse(game.state.round.endsAt));
    expect(state.phase).toBe('reveal');
    expect(state.round.scoreDelta).toEqual({ host: 2, guest: 0 });
  });

  it('refuses a guess after the deadline and for a stale round', () => {
    const game = newGame();
    const late = act(game, 'host', 'guess', { letter: 'k' }, game.now + HANGMAN_ROUND_MS + 1);
    expect(late).toMatchObject({ ok: false, code: 'ROUND_CLOSED' });
    expect(act(game, 'host', 'guess', { letter: 'k', roundId: 'r2' })).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });
  });

  it('catches up a silent match from the persisted deadlines and finishes it', () => {
    const game = newGame();
    act(game, 'guest', 'guess', { letter: 'a' });
    const { state } = advanceHangman(game.state, game.privateState, game.now + 3_600_000);
    expect(state.phase).toBe('finished');
    expect(state.result).toMatchObject({
      winner: 'Bora',
      draw: false,
      reason: 'rounds_complete',
      scores: { host: 0, guest: 1 },
    });
    const expectedEnd =
      game.now + HANGMAN_ROUND_COUNT * HANGMAN_ROUND_MS + HANGMAN_ROUND_COUNT * HANGMAN_REVEAL_MS;
    expect(state.phaseEndsAt).toBe(new Date(expectedEnd).toISOString());
  });

  it('finishes on resign with the opponent as winner', () => {
    const game = newGame();
    expect(act(game, 'guest', 'resign').ok).toBe(true);
    expect(game.state.result).toMatchObject({ winner: 'Ada', reason: 'resign' });
  });

  it('does not mutate its arguments', () => {
    const game = newGame();
    const before = json({ state: game.state, privateState: game.privateState });
    applyHangmanAction({
      state: game.state,
      privateState: game.privateState,
      actorKey: 'host',
      envelope: { actionId: 'act_pure_1', roundId: 'r1', type: 'guess', letter: 'k' },
      nowMs: game.now,
    });
    advanceHangman(game.state, game.privateState, game.now + 3_600_000);
    expect(json({ state: game.state, privateState: game.privateState })).toBe(before);
  });
});
