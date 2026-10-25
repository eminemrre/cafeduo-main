/** @jest-environment node */
const {
  DRAW_CHOOSE_MS,
  DRAW_HINT_AT_MS,
  DRAW_MAX_GUESSES,
  DRAW_REVEAL_MS,
  DRAW_ROUND_COUNT,
  DRAW_ROUND_MS,
  actorDrawView,
  advanceDraw,
  applyDrawAction,
  createDrawPrivateState,
  createDrawPublicState,
  isCloseGuess,
  startDrawState,
} = require('./drawEngine');
const fixture = require('./data/words.fixture.json');

const T0 = 1_000_000;
const choices = (a, b, c) => [
  { word: a, category: 'Hayvanlar', difficulty: 1 },
  { word: b, category: 'Ulaşım', difficulty: 2 },
  { word: c, category: 'Şehir hayatı', difficulty: 3 },
];

const newGame = () => {
  const privateState = createDrawPrivateState({ randomInt: () => 0, words: fixture });
  privateState.rounds = [
    { drawer: 'host', choices: choices('kedi', 'fayton', 'arasta'), autoPick: 1, hintSeeds: [0, 0.99] },
    { drawer: 'guest', choices: choices('kuş', 'şilep', 'sebil'), autoPick: 0, hintSeeds: [0.5, 0.1] },
    { drawer: 'host', choices: choices('arı', 'kağnı', 'drezin'), autoPick: 2, hintSeeds: [0, 0.5] },
    { drawer: 'guest', choices: choices('fil', 'tekerlek', 'hendek'), autoPick: 0, hintSeeds: [0, 0.5] },
  ];
  const state = startDrawState({
    state: createDrawPublicState({ hostName: 'Ada', guestName: 'Bora' }),
    privateState,
    hostName: 'Ada',
    guestName: 'Bora',
    nowMs: T0,
  });
  return { state, privateState };
};

let counter = 0;
const act = (game, actorKey, type, extra = {}, nowMs) => {
  counter += 1;
  const result = applyDrawAction({
    state: game.state,
    privateState: game.privateState,
    actorKey,
    envelope: { actionId: `draw_${counter}_act`, roundId: game.state.round?.id, type, ...extra },
    nowMs,
  });
  if (result.ok) {
    game.state = result.state;
    game.privateState = result.privateState;
  }
  return result;
};
const json = (value) => JSON.stringify(value);
const WORDS = /kedi|fayton|arasta|kuş|şilep|sebil|kağnı|drezin|tekerlek|hendek/;

describe('drawEngine', () => {
  it('deals each round three drawable words, one per difficulty, never repeating', () => {
    let seed = 3;
    const words = [...fixture, { word: 'özlem', category: 'Hayvanlar', difficulty: 1, drawable: false }];
    const privateState = createDrawPrivateState({
      words,
      randomInt: (max) => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % max;
      },
      random: () => 0.42,
    });
    expect(privateState.rounds.map((round) => round.drawer)).toEqual(['host', 'guest', 'host', 'guest']);
    const all = privateState.rounds.flatMap((round) => round.choices.map((choice) => choice.word));
    expect(new Set(all).size).toBe(DRAW_ROUND_COUNT * 3);
    expect(all).not.toContain('özlem');
    for (const round of privateState.rounds) {
      expect(round.choices.map((choice) => choice.difficulty)).toEqual([1, 2, 3]);
      expect([0, 1, 2]).toContain(round.autoPick);
    }
  });

  it('opens with the host choosing; the choices reach only the drawer', () => {
    const game = newGame();
    expect(game.state.phase).toBe('choosing');
    expect(game.state.round).toMatchObject({ id: 'r1', drawer: 'host' });
    expect(game.state.phaseEndsAt).toBe(new Date(T0 + DRAW_CHOOSE_MS).toISOString());
    expect(json(game.state)).not.toMatch(WORDS);
    expect(actorDrawView(game.state, game.privateState, 'host')).toEqual({
      roundId: 'r1',
      role: 'drawer',
      choices: [
        { word: 'kedi', difficulty: 1 },
        { word: 'fayton', difficulty: 2 },
        { word: 'arasta', difficulty: 3 },
      ],
    });
    expect(actorDrawView(game.state, game.privateState, 'guest')).toEqual({ roundId: 'r1', role: 'guesser' });
  });

  it('lets only the drawer pick, then starts a 75 s drawing with the shape of the word', () => {
    const game = newGame();
    expect(act(game, 'guest', 'pick', { optionIndex: 0 }, T0 + 1000)).toMatchObject({ ok: false, code: 'NOT_DRAWER' });
    expect(act(game, 'host', 'pick', { optionIndex: 3 }, T0 + 1000)).toMatchObject({ ok: false, code: 'INVALID_OPTION' });
    expect(act(game, 'host', 'pick', { optionIndex: 1 }, T0 + 2000).ok).toBe(true);
    expect(game.state.phase).toBe('drawing');
    expect(game.state.round).toMatchObject({
      length: 6,
      difficulty: 2,
      category: 'Ulaşım',
      hint: [null, null, null, null, null, null],
      guesses: [],
      drawStartedAt: new Date(T0 + 2000).toISOString(),
      endsAt: new Date(T0 + 2000 + DRAW_ROUND_MS).toISOString(),
    });
    // The next deadline is the first hint, not the end of the round.
    expect(game.state.phaseEndsAt).toBe(new Date(T0 + 2000 + DRAW_HINT_AT_MS[0]).toISOString());
    expect(json(game.state)).not.toMatch(WORDS);
    expect(actorDrawView(game.state, game.privateState, 'host')).toEqual({ roundId: 'r1', role: 'drawer', word: 'fayton' });
    expect(actorDrawView(game.state, game.privateState, 'guest')).toEqual({ roundId: 'r1', role: 'guesser' });
  });

  it('picks the seeded word when the drawer lets the choice run out', () => {
    const game = newGame();
    const { state } = advanceDraw(game.state, game.privateState, T0 + DRAW_CHOOSE_MS);
    expect(state.phase).toBe('drawing');
    expect(state.round).toMatchObject({ length: 6, drawStartedAt: new Date(T0 + DRAW_CHOOSE_MS).toISOString() });
  });

  it('opens one letter at 30 s and another at 50 s from the persisted start', () => {
    const game = newGame();
    act(game, 'host', 'pick', { optionIndex: 1 }, T0); // fayton; seeds 0 → position 0, 0.99 → last free
    const at30 = advanceDraw(game.state, game.privateState, T0 + DRAW_HINT_AT_MS[0]).state;
    expect(at30.round.hint).toEqual(['f', null, null, null, null, null]);
    expect(at30.phaseEndsAt).toBe(new Date(T0 + DRAW_HINT_AT_MS[1]).toISOString());
    const at50 = advanceDraw(game.state, game.privateState, T0 + DRAW_HINT_AT_MS[1] + 5).state;
    expect(at50.round.hint).toEqual(['f', null, null, null, null, 'n']);
    expect(at50.phaseEndsAt).toBe(new Date(T0 + DRAW_ROUND_MS).toISOString());
  });

  it('logs wrong guesses, marks a one-letter miss as close, and refuses the drawer', () => {
    const game = newGame();
    act(game, 'host', 'pick', { optionIndex: 1 }, T0);
    expect(act(game, 'host', 'solve', { word: 'fayton' }, T0 + 1000)).toMatchObject({ ok: false, code: 'NOT_GUESSER' });
    act(game, 'guest', 'solve', { word: 'araba' }, T0 + 2000);
    act(game, 'guest', 'solve', { word: 'faytun' }, T0 + 3000);
    expect(game.state.phase).toBe('drawing');
    expect(game.state.round.guesses).toEqual([
      { text: 'araba', close: false },
      { text: 'faytun', close: true },
    ]);
  });

  it('scores a right guess by time and difficulty, gives the drawer half, and reveals the word', () => {
    const game = newGame();
    act(game, 'host', 'pick', { optionIndex: 1 }, T0); // difficulty 2 → ×1.2
    // 15 s in: 60 s left → round((10 + 12) × 1.2) = 26; drawer floor(26 / 2) = 13
    expect(act(game, 'guest', 'solve', { word: 'fayton' }, T0 + 15_000).ok).toBe(true);
    expect(game.state.phase).toBe('reveal');
    expect(game.state.round).toMatchObject({ word: 'fayton', solved: true, scoreDelta: { host: 13, guest: 26 } });
    expect(game.state.players.guest.score).toBe(26);
    expect(game.state.players.host.score).toBe(13);
    expect(game.state.round.guesses).toEqual([]);
    expect(game.state.phaseEndsAt).toBe(new Date(T0 + 15_000 + DRAW_REVEAL_MS).toISOString());
    const next = advanceDraw(game.state, game.privateState, T0 + 15_000 + DRAW_REVEAL_MS).state;
    expect(next.phase).toBe('choosing');
    expect(next.round).toMatchObject({ id: 'r2', drawer: 'guest' });
    expect(json(next)).not.toMatch(/kuş|şilep|sebil/);
  });

  it('closes a round without points when time runs out or the guesser reports letters', () => {
    const game = newGame();
    act(game, 'host', 'pick', { optionIndex: 0 }, T0);
    const timedOut = advanceDraw(game.state, game.privateState, T0 + DRAW_ROUND_MS).state;
    expect(timedOut.phase).toBe('reveal');
    expect(timedOut.round).toMatchObject({ word: 'kedi', solved: false, scoreDelta: { host: 0, guest: 0 } });

    const other = newGame();
    act(other, 'host', 'pick', { optionIndex: 0 }, T0);
    expect(act(other, 'host', 'report', {}, T0 + 1000)).toMatchObject({ ok: false, code: 'NOT_GUESSER' });
    expect(act(other, 'guest', 'report', {}, T0 + 1000).ok).toBe(true);
    expect(other.state.round).toMatchObject({ reported: true, solved: false, scoreDelta: { host: 0, guest: 0 } });
  });

  it('caps the guesses of a round', () => {
    const game = newGame();
    act(game, 'host', 'pick', { optionIndex: 1 }, T0);
    for (let i = 0; i < DRAW_MAX_GUESSES; i += 1) {
      expect(act(game, 'guest', 'solve', { word: `kelime${'abcçdefgğhıijklmnoöprsştuüvyz'[i % 29]}` }, T0 + 100).ok).toBe(true);
    }
    expect(act(game, 'guest', 'solve', { word: 'fayton' }, T0 + 200)).toMatchObject({ ok: false, code: 'TOO_MANY_GUESSES' });
  });

  it('refuses actions after the deadline, for a stale round and before the drawing', () => {
    const game = newGame();
    expect(act(game, 'guest', 'solve', { word: 'kedi' }, T0 + 1000)).toMatchObject({ ok: false, code: 'ROUND_NOT_DRAWING' });
    act(game, 'host', 'pick', { optionIndex: 0 }, T0);
    expect(act(game, 'guest', 'solve', { word: 'kedi' }, T0 + DRAW_ROUND_MS + 1)).toMatchObject({ ok: false });
    expect(game.state.phase).toBe('drawing');
    expect(act(game, 'guest', 'solve', { word: 'kedi', roundId: 'r2' }, T0 + 1000)).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });
  });

  it('catches a silent match up from persisted deadlines and finishes it', () => {
    const game = newGame();
    act(game, 'guest', 'resign', {}, T0 + 1); // keep the result pure for this check below
    const silent = newGame();
    const { state } = advanceDraw(silent.state, silent.privateState, T0 + 3_600_000);
    expect(state.phase).toBe('finished');
    expect(state.result).toMatchObject({ draw: true, reason: 'rounds_complete', scores: { host: 0, guest: 0 } });
    const perRound = DRAW_CHOOSE_MS + DRAW_ROUND_MS + DRAW_REVEAL_MS;
    expect(state.phaseEndsAt).toBe(new Date(T0 + DRAW_ROUND_COUNT * perRound).toISOString());
    expect(game.state.result).toMatchObject({ winner: 'Ada', reason: 'resign' });
  });

  it('plays four rounds and the higher total wins', () => {
    const game = newGame();
    let now = T0;
    for (const [drawer, guesser, index] of [
      ['host', 'guest', 0],
      ['guest', 'host', 0],
      ['host', 'guest', 0],
      ['guest', 'host', 0],
    ]) {
      act(game, drawer, 'pick', { optionIndex: index }, now);
      const word = actorDrawView(game.state, game.privateState, drawer).word;
      act(game, guesser, 'solve', { word }, now + (guesser === 'guest' ? 5_000 : 30_000));
      now = Date.parse(game.state.phaseEndsAt);
      game.state = advanceDraw(game.state, game.privateState, now).state;
    }
    expect(game.state.phase).toBe('finished');
    expect(game.state.result.winner).toBe('Bora');
    expect(game.state.result.scores.guest).toBeGreaterThan(game.state.result.scores.host);
  });

  it('does not mutate its arguments', () => {
    const game = newGame();
    const before = json(game);
    applyDrawAction({
      state: game.state,
      privateState: game.privateState,
      actorKey: 'host',
      envelope: { actionId: 'draw_pure_1', roundId: 'r1', type: 'pick', optionIndex: 0 },
      nowMs: T0,
    });
    advanceDraw(game.state, game.privateState, T0 + 3_600_000);
    expect(json(game)).toBe(before);
  });

  it('knows a close guess', () => {
    expect(isCloseGuess('faytun', 'fayton')).toBe(true);
    expect(isCloseGuess('fayto', 'fayton')).toBe(true);
    expect(isCloseGuess('faytonn', 'fayton')).toBe(true);
    expect(isCloseGuess('fayton', 'fayton')).toBe(false);
    expect(isCloseGuess('fytun', 'fayton')).toBe(false);
    expect(isCloseGuess('ka', 'kaş')).toBe(false);
  });
});
