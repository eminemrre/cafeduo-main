/**
 * Adam Asmaca Düellosu engine (protocol v2).
 *
 * Same shape as the quiz and aim engines: pure functions, the caller passes
 * the server clock and persists the returned states. Both players solve the
 * same hidden word at the same time on their own board.
 *
 * Rules (approved 2026-10-24): three rounds (one word per difficulty, three
 * different categories), 60 s each, six wrong letters per board. A whole-word
 * guess that is wrong costs two lives. A solved board scores 10 + 2 per life
 * left + one per 6 s left; an unsolved one scores the positions it opened.
 *
 * The words live only in the private state. The public state carries the
 * word's length and category and each board's counts (positions opened,
 * wrong letters, solved, done); a board's letters reach only its owner as
 * `actorView.hangman`. The word becomes public when its round closes.
 */

const { randomInt: cryptoRandomInt } = require('crypto');
const { getWordBank } = require('./wordBank');
const { ACTION_TYPES } = require('./actionProtocol');

const HANGMAN_ROUND_COUNT = 3;
const HANGMAN_ROUND_MS = 60_000;
const HANGMAN_REVEAL_MS = 2_500;
const HANGMAN_MAX_WRONG = 6;
const HANGMAN_SOLVE_PENALTY = 2;
const HANGMAN_SOLVED_POINTS = 10;
const HANGMAN_POINTS_PER_LIFE = 2;
const HANGMAN_SECONDS_PER_POINT = 6;

const iso = (ms) => new Date(ms).toISOString();
const toMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const playerKeys = ['host', 'guest'];
const otherKey = (key) => (key === 'host' ? 'guest' : 'host');

/** One word per difficulty (1, 2, 3), each from a different category. */
const pickRounds = (randomInt, words) => {
  if (!Array.isArray(words) || !words.length) throw new Error('Hangman word bank is unavailable');
  const used = new Set();
  const rounds = [];
  for (const difficulty of [1, 2, 3]) {
    const pool = words.filter((entry) => entry.difficulty === difficulty && !used.has(entry.category));
    const entry = pool[randomInt(pool.length)];
    used.add(entry.category);
    rounds.push({ word: entry.word, category: entry.category, difficulty: entry.difficulty });
  }
  return rounds;
};

const createHangmanPrivateState = ({
  randomInt = (max) => cryptoRandomInt(0, max),
  words = getWordBank().words,
} = {}) => ({
  version: 2,
  kind: 'hangman',
  rounds: pickRounds(randomInt, words),
  boards: {},
  actions: { host: {}, guest: {} },
});

const makePlayer = (name) => ({
  name: String(name || '').trim() || null,
  score: 0,
  roundsWon: 0,
  answered: false,
  left: false,
});

const createHangmanPublicState = ({ hostName, guestName, totalRounds = HANGMAN_ROUND_COUNT }) => ({
  version: 2,
  kind: 'hangman',
  revision: 0,
  phase: 'waiting',
  roundIndex: 0,
  totalRounds,
  startedAt: null,
  phaseEndsAt: null,
  updatedAt: iso(Date.now()),
  players: { host: makePlayer(hostName), guest: makePlayer(guestName) },
  round: null,
  result: null,
});

const emptyBoard = () => ({ guessed: [], wrong: 0, solved: false, done: false, doneAt: null, points: 0 });

const roundBoards = (privateState, roundId) => {
  const all = privateState?.boards && typeof privateState.boards === 'object' ? privateState.boards : {};
  const boards = all[roundId] && typeof all[roundId] === 'object' ? all[roundId] : {};
  return { host: boards.host || emptyBoard(), guest: boards.guest || emptyBoard() };
};

const letterSet = (word) => new Set([...word]);

/** Positions of the word this board has opened (all of them once solved). */
const patternOf = (word, board) => {
  const guessed = new Set(board.guessed);
  return [...word].map((letter) => (board.solved || guessed.has(letter) ? letter : null));
};

const progressOf = (word, board) => ({
  revealed: patternOf(word, board).filter(Boolean).length,
  wrong: board.wrong,
  solved: board.solved,
  done: board.done,
});

const publishProgress = (state, privateState) => {
  const round = state.round;
  const entry = privateState.rounds[round.index];
  const boards = roundBoards(privateState, round.id);
  round.progress = {
    host: progressOf(entry.word, boards.host),
    guest: progressOf(entry.word, boards.guest),
  };
  for (const key of playerKeys) state.players[key].answered = boards[key].done;
};

const openRound = (state, privateState, index, nowMs) => {
  const entry = privateState.rounds[index];
  if (!entry) return false;
  const endsAt = nowMs + HANGMAN_ROUND_MS;
  state.phase = 'open';
  state.roundIndex = index + 1;
  state.phaseEndsAt = iso(endsAt);
  state.updatedAt = iso(nowMs);
  state.round = {
    id: `r${index + 1}`,
    index,
    startedAt: iso(nowMs),
    endsAt: iso(endsAt),
    length: [...entry.word].length,
    category: entry.category,
    difficulty: entry.difficulty,
    maxWrong: HANGMAN_MAX_WRONG,
  };
  publishProgress(state, privateState);
  state.revision += 1;
  return true;
};

const startHangmanState = ({ state, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const next = clone(state);
  if (next.phase === 'open' || next.phase === 'reveal' || next.phase === 'finished') return next;
  if (!privateState || !Array.isArray(privateState.rounds) || !privateState.rounds.length) {
    throw new Error('Hangman private state has no rounds');
  }
  next.totalRounds = privateState.rounds.length;
  next.players.host = { ...makePlayer(hostName), ...next.players.host, name: hostName || null };
  next.players.guest = { ...makePlayer(guestName), ...next.players.guest, name: guestName || null };
  next.startedAt = iso(nowMs);
  next.updatedAt = iso(nowMs);
  openRound(next, privateState, 0, nowMs);
  return next;
};

/** Points of a board when its round closes. */
const boardPoints = (word, board, endsAtMs) => {
  if (board.solved) {
    const livesLeft = Math.max(0, HANGMAN_MAX_WRONG - board.wrong);
    const secondsLeft = Math.max(0, (endsAtMs - toMs(board.doneAt)) / 1000);
    return (
      HANGMAN_SOLVED_POINTS +
      livesLeft * HANGMAN_POINTS_PER_LIFE +
      Math.floor(secondsLeft / HANGMAN_SECONDS_PER_POINT)
    );
  }
  return patternOf(word, board).filter(Boolean).length;
};

const resolveRound = (state, privateState, closedAtMs) => {
  const round = state.round;
  const entry = privateState.rounds[round.index];
  const boards = roundBoards(privateState, round.id);
  const scoreDelta = {};
  const endsAtMs = toMs(round.endsAt);
  for (const key of playerKeys) {
    const points = boardPoints(entry.word, boards[key], endsAtMs);
    scoreDelta[key] = points;
    state.players[key].score += points;
    if (boards[key].solved) state.players[key].roundsWon += 1;
  }
  publishProgress(state, privateState);
  round.word = entry.word;
  round.scoreDelta = scoreDelta;
  state.phase = 'reveal';
  state.phaseEndsAt = iso(closedAtMs + HANGMAN_REVEAL_MS);
  state.updatedAt = iso(closedAtMs);
  state.revision += 1;
};

const finishHangman = (state, atMs, { winnerKey, reason } = {}) => {
  const { host, guest } = state.players;
  const draw = winnerKey ? false : host.score === guest.score;
  const winner = winnerKey
    ? state.players[winnerKey].name
    : draw
      ? null
      : host.score > guest.score
        ? host.name
        : guest.name;
  state.phase = 'finished';
  state.phaseEndsAt = iso(atMs);
  state.updatedAt = iso(atMs);
  state.result = {
    winner,
    draw,
    reason: reason || 'rounds_complete',
    scores: { host: host.score, guest: guest.score },
  };
  state.revision += 1;
};

/**
 * Moves the match clock forward from persisted deadlines: closes a round whose
 * boards are both done or whose time is up, then opens the next one or
 * finishes. Does not mutate its arguments.
 */
const advanceHangman = (state, privateState, nowMs = Date.now()) => {
  if (!state || state.kind !== 'hangman' || state.phase === 'finished' || state.phase === 'waiting') {
    return { state, changed: false };
  }
  const next = clone(state);
  let changed = false;
  for (let step = 0; step <= HANGMAN_ROUND_COUNT; step += 1) {
    if (next.phase === 'open' && next.round) {
      const boards = roundBoards(privateState, next.round.id);
      const bothDone = boards.host.done && boards.guest.done;
      if (bothDone || nowMs >= toMs(next.round.endsAt)) {
        const closedAt = bothDone
          ? Math.max(toMs(boards.host.doneAt), toMs(boards.guest.doneAt))
          : toMs(next.round.endsAt);
        resolveRound(next, privateState, closedAt);
        changed = true;
      }
    }
    if (next.phase === 'reveal' && nowMs >= toMs(next.phaseEndsAt)) {
      const opensAt = toMs(next.phaseEndsAt);
      if (next.roundIndex >= next.totalRounds || !privateState.rounds[next.roundIndex]) {
        finishHangman(next, opensAt);
      } else {
        openRound(next, privateState, next.roundIndex, opensAt);
      }
      changed = true;
    } else break;
  }
  return { state: next, changed };
};

const reject = (status, code, message) => ({ ok: false, status, code, message });

const applyHangmanAction = ({ state, privateState, actorKey, envelope, nowMs = Date.now() }) => {
  if (!playerKeys.includes(actorKey)) {
    return reject(403, 'NOT_PARTICIPANT', 'Bu oyunun oyuncusu değilsin.');
  }
  if (!state || state.kind !== 'hangman' || !state.round) {
    return reject(409, 'GAME_NOT_STARTED', 'Oyun henüz başlamadı.');
  }
  const next = advanceHangman(state, privateState, nowMs).state;
  if (next.phase === 'finished') return reject(409, 'GAME_FINISHED', 'Oyun tamamlandı.');

  if (envelope.type === ACTION_TYPES.RESIGN) {
    const finished = clone(next);
    finishHangman(finished, nowMs, { winnerKey: otherKey(actorKey), reason: 'resign' });
    return { ok: true, state: finished, privateState: clone(privateState) };
  }

  if (!next.round || envelope.roundId !== next.round.id) {
    return reject(409, 'STALE_ROUND', 'Bu tur artık açık değil.');
  }
  if (next.phase !== 'open') return reject(409, 'ROUND_CLOSED', 'Tur süresi doldu.');
  if (nowMs < toMs(next.round.startedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem bu tur başlamadan ulaştı.');
  }

  const nextPrivate = clone(privateState);
  const roundId = next.round.id;
  const word = nextPrivate.rounds[next.round.index].word;
  const boards = roundBoards(nextPrivate, roundId);
  const board = { ...boards[actorKey], guessed: [...boards[actorKey].guessed] };
  if (board.done) return reject(409, 'BOARD_DONE', 'Bu turdaki tahtan tamamlandı.');

  if (envelope.type === ACTION_TYPES.GUESS) {
    const letter = envelope.letter;
    if (board.guessed.includes(letter)) {
      return reject(409, 'ALREADY_GUESSED', 'Bu harfi zaten denedin.');
    }
    board.guessed.push(letter);
    if (!letterSet(word).has(letter)) board.wrong += 1;
    else if (patternOf(word, board).every(Boolean)) board.solved = true;
  } else if (envelope.type === ACTION_TYPES.SOLVE) {
    if (envelope.word === word) board.solved = true;
    else board.wrong = Math.min(HANGMAN_MAX_WRONG, board.wrong + HANGMAN_SOLVE_PENALTY);
  } else {
    return reject(400, 'INVALID_ACTION_FOR_GAME', 'Bu eylem Adam Asmaca için geçerli değil.');
  }

  if (board.solved || board.wrong >= HANGMAN_MAX_WRONG) {
    board.done = true;
    board.doneAt = iso(nowMs);
  }
  board.points = boardPoints(word, board, toMs(next.round.endsAt));
  nextPrivate.boards = { ...(nextPrivate.boards || {}), [roundId]: { ...boards, [actorKey]: board } };

  publishProgress(next, nextPrivate);
  next.updatedAt = iso(nowMs);
  next.revision += 1;
  const after = board.done ? advanceHangman(next, nextPrivate, nowMs).state : next;
  return { ok: true, state: after, privateState: nextPrivate };
};

/** The requesting player's own board for the open (or just closed) round. */
const actorBoard = (state, privateState, actorKey) => {
  const round = state?.round;
  const entry = round && privateState?.rounds?.[round.index];
  if (!round || !entry || !playerKeys.includes(actorKey)) return null;
  const board = roundBoards(privateState, round.id)[actorKey];
  return {
    roundId: round.id,
    pattern: patternOf(entry.word, board),
    guessed: [...board.guessed],
    wrong: board.wrong,
    solved: board.solved,
    done: board.done,
    points: board.points,
  };
};

module.exports = {
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
};
