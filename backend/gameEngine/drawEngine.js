/**
 * Çiz Bil engine (protocol v2).
 *
 * Same shape as the other engines: pure functions, the caller passes the
 * server clock and persists the returned states.
 *
 * Rules (approved 2026-10-24): four rounds, the drawer alternates (host draws
 * r1 and r3). The drawer has 10 s to pick one of three words (difficulty 1, 2,
 * 3; the seeded word is taken when time runs out), then 75 s to draw. The
 * guesser may guess as often as it likes (up to 40 per round); a one-letter
 * miss is marked close. One letter of the word opens at 30 s and another at
 * 50 s. A right guess scores round((10 + seconds left / 5) × 1 / 1.2 / 1.5) for
 * the guesser and half of that for the drawer. Drawing letters is not allowed:
 * the guesser may report it, which closes the round without points.
 *
 * The strokes never pass through the engine (see drawStrokes.js); they cannot
 * change a score. The choices and the word live only in the private state;
 * the drawer sees them as `actorView.draw`. The public round carries the
 * word's length, category and difficulty, the opened hint letters and the
 * guess log; the word becomes public when its round closes.
 *
 * The next deadline (`phaseEndsAt`) is the next hint while drawing, so the
 * readers and the deadline job open hints on time; `round.endsAt` is the end
 * of the drawing.
 */

const { randomInt: cryptoRandomInt } = require('crypto');
const { getWordBank } = require('./wordBank');
const { ACTION_TYPES } = require('./actionProtocol');

const DRAW_ROUND_COUNT = 4;
const DRAW_CHOOSE_MS = 10_000;
const DRAW_ROUND_MS = 75_000;
const DRAW_HINT_AT_MS = Object.freeze([30_000, 50_000]);
const DRAW_REVEAL_MS = 3_000;
const DRAW_MAX_GUESSES = 40;
const DRAW_BASE_POINTS = 10;
const DRAW_SECONDS_PER_POINT = 5;
const DRAW_MULTIPLIER = Object.freeze({ 1: 1, 2: 1.2, 3: 1.5 });

const iso = (ms) => new Date(ms).toISOString();
const toMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const playerKeys = ['host', 'guest'];
const otherKey = (key) => (key === 'host' ? 'guest' : 'host');
const letters = (word) => [...word];

/** Edit distance exactly one (one letter changed, added or dropped). */
const isCloseGuess = (guess, word) => {
  const a = letters(String(guess || ''));
  const b = letters(String(word || ''));
  if (a.length < 3 || b.length < 3 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  edits += a.length - i + (b.length - j);
  return edits === 1;
};

/** Three drawable words per round (difficulty 1, 2, 3), none repeated in the match. */
const dealRounds = ({ words, randomInt, random }) => {
  if (!Array.isArray(words) || !words.length) throw new Error('Draw word bank is unavailable');
  const drawable = words.filter((entry) => entry.drawable !== false);
  const used = new Set();
  const rounds = [];
  for (let index = 0; index < DRAW_ROUND_COUNT; index += 1) {
    const choices = [1, 2, 3].map((difficulty) => {
      const pool = drawable.filter((entry) => entry.difficulty === difficulty && !used.has(entry.word));
      if (!pool.length) throw new Error('Draw word bank has too few drawable words');
      const entry = pool[randomInt(pool.length)];
      used.add(entry.word);
      return { word: entry.word, category: entry.category, difficulty: entry.difficulty };
    });
    rounds.push({
      drawer: index % 2 === 0 ? 'host' : 'guest',
      choices,
      autoPick: randomInt(3),
      hintSeeds: [random(), random()],
    });
  }
  return rounds;
};

const createDrawPrivateState = ({
  randomInt = (max) => cryptoRandomInt(0, max),
  random = () => cryptoRandomInt(0, 1_000_000) / 1_000_000,
  words = getWordBank().words,
} = {}) => ({
  version: 2,
  kind: 'draw',
  rounds: dealRounds({ words, randomInt, random }),
  guessCounts: {},
  actions: { host: {}, guest: {} },
});

const makePlayer = (name) => ({
  name: String(name || '').trim() || null,
  score: 0,
  roundsWon: 0,
  answered: false,
  left: false,
});

const createDrawPublicState = ({ hostName, guestName, totalRounds = DRAW_ROUND_COUNT }) => ({
  version: 2,
  kind: 'draw',
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

/** The picked word. Its index lives on the public round (`round.pick`, never
 * sent to clients); the choices themselves stay private. */
const pickedOf = (state, privateState) => {
  const round = state?.round;
  const entry = round && privateState?.rounds?.[round.index];
  return entry && Number.isInteger(round.pick) ? entry.choices[round.pick] || null : null;
};

/** Positions opened by the hints, in order: each seed picks among the still closed positions. */
const hintPositions = (word, seeds) => {
  const free = letters(word).map((_, index) => index);
  const out = [];
  for (const seed of seeds) {
    if (free.length <= 1) break;
    const at = Math.min(free.length - 1, Math.floor(Math.max(0, Number(seed) || 0) * free.length));
    out.push(free.splice(at, 1)[0]);
  }
  return out;
};

const openChoosing = (state, index, nowMs) => {
  const drawer = index % 2 === 0 ? 'host' : 'guest';
  const endsAt = nowMs + DRAW_CHOOSE_MS;
  state.phase = 'choosing';
  state.roundIndex = index + 1;
  state.phaseEndsAt = iso(endsAt);
  state.updatedAt = iso(nowMs);
  state.round = { id: `r${index + 1}`, index, drawer, startedAt: iso(nowMs), endsAt: iso(endsAt) };
  for (const key of playerKeys) state.players[key].answered = false;
  state.revision += 1;
};

/** Next deadline while drawing: the next unopened hint, else the end. */
const drawingDeadline = (round) => {
  const start = toMs(round.drawStartedAt);
  const opened = Number(round.hintsOpened) || 0;
  const next = DRAW_HINT_AT_MS.find((offset, i) => i >= opened && start + offset < toMs(round.endsAt));
  return next === undefined ? toMs(round.endsAt) : start + next;
};

const startDrawing = (state, privateState, pick, atMs) => {
  state.round.pick = pick;
  const entry = pickedOf(state, privateState);
  const length = letters(entry.word).length;
  Object.assign(state.round, {
    drawStartedAt: iso(atMs),
    endsAt: iso(atMs + DRAW_ROUND_MS),
    length,
    category: entry.category,
    difficulty: entry.difficulty,
    hint: Array.from({ length }, () => null),
    hintsOpened: 0,
    guesses: [],
    solved: false,
    reported: false,
  });
  state.phase = 'drawing';
  state.phaseEndsAt = iso(drawingDeadline(state.round));
  state.updatedAt = iso(atMs);
  state.revision += 1;
};

const openHints = (state, privateState, nowMs) => {
  const round = state.round;
  const entry = pickedOf(state, privateState);
  const positions = hintPositions(entry.word, privateState.rounds[round.index].hintSeeds || []);
  const start = toMs(round.drawStartedAt);
  let changed = false;
  while (
    round.hintsOpened < DRAW_HINT_AT_MS.length &&
    round.hintsOpened < positions.length &&
    nowMs >= start + DRAW_HINT_AT_MS[round.hintsOpened] &&
    start + DRAW_HINT_AT_MS[round.hintsOpened] < toMs(round.endsAt)
  ) {
    const at = positions[round.hintsOpened];
    round.hint[at] = letters(entry.word)[at];
    round.hintsOpened += 1;
    changed = true;
  }
  if (changed) {
    state.phaseEndsAt = iso(drawingDeadline(round));
    state.revision += 1;
  }
  return changed;
};

const guesserPoints = (difficulty, secondsLeft) =>
  Math.round(
    (DRAW_BASE_POINTS + Math.floor(Math.max(0, secondsLeft) / DRAW_SECONDS_PER_POINT)) *
      (DRAW_MULTIPLIER[difficulty] || 1)
  );

const closeRound = (state, privateState, closedAtMs, { solvedAtMs = null, reported = false } = {}) => {
  const round = state.round;
  const entry = pickedOf(state, privateState);
  const drawer = round.drawer;
  const guesser = otherKey(drawer);
  const scoreDelta = { host: 0, guest: 0 };
  if (solvedAtMs !== null) {
    const points = guesserPoints(entry.difficulty, (toMs(round.endsAt) - solvedAtMs) / 1000);
    scoreDelta[guesser] = points;
    scoreDelta[drawer] = Math.floor(points / 2);
    state.players[guesser].roundsWon += 1;
  }
  for (const key of playerKeys) state.players[key].score += scoreDelta[key];
  round.solved = solvedAtMs !== null;
  round.reported = reported;
  if (round.solved) round.guesses = round.guesses.filter((guess) => guess.text !== entry.word);
  round.word = entry.word;
  round.scoreDelta = scoreDelta;
  state.phase = 'reveal';
  state.phaseEndsAt = iso(closedAtMs + DRAW_REVEAL_MS);
  state.updatedAt = iso(closedAtMs);
  state.revision += 1;
};

const finishDraw = (state, atMs, { winnerKey, reason } = {}) => {
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

/** Moves the clock forward from persisted deadlines; never mutates its arguments. */
const advanceWith = (state, privateState, nowMs) => {
  const next = clone(state);
  let changed = false;
  for (let step = 0; step < DRAW_ROUND_COUNT * 6; step += 1) {
    if (next.phase === 'choosing' && nowMs >= toMs(next.round.endsAt)) {
      const at = toMs(next.round.endsAt);
      const auto = privateState.rounds[next.round.index].autoPick;
      startDrawing(next, privateState, Number.isInteger(auto) ? auto : 0, at);
      changed = true;
      continue;
    }
    if (next.phase === 'drawing') {
      const end = toMs(next.round.endsAt);
      if (openHints(next, privateState, Math.min(nowMs, end - 1))) changed = true;
      if (nowMs >= end) {
        closeRound(next, privateState, end);
        changed = true;
        continue;
      }
      break;
    }
    if (next.phase === 'reveal' && nowMs >= toMs(next.phaseEndsAt)) {
      const at = toMs(next.phaseEndsAt);
      if (next.roundIndex >= next.totalRounds || !privateState.rounds[next.roundIndex]) finishDraw(next, at);
      else openChoosing(next, next.roundIndex, at);
      changed = true;
      continue;
    }
    break;
  }
  return { state: next, changed };
};

const advanceDraw = (state, privateState, nowMs = Date.now()) => {
  if (!state || state.kind !== 'draw' || state.phase === 'finished' || state.phase === 'waiting') {
    return { state, changed: false };
  }
  return advanceWith(state, privateState, nowMs);
};

const startDrawState = ({ state, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const next = clone(state);
  if (next.phase !== 'waiting') return next;
  if (!privateState || !Array.isArray(privateState.rounds) || !privateState.rounds.length) {
    throw new Error('Draw private state has no rounds');
  }
  next.totalRounds = privateState.rounds.length;
  next.players.host = { ...makePlayer(hostName), ...next.players.host, name: hostName || null };
  next.players.guest = { ...makePlayer(guestName), ...next.players.guest, name: guestName || null };
  next.startedAt = iso(nowMs);
  openChoosing(next, 0, nowMs);
  return next;
};

const reject = (status, code, message) => ({ ok: false, status, code, message });

const applyDrawAction = ({ state, privateState, actorKey, envelope, nowMs = Date.now() }) => {
  if (!playerKeys.includes(actorKey)) return reject(403, 'NOT_PARTICIPANT', 'Bu oyunun oyuncusu değilsin.');
  if (!state || state.kind !== 'draw' || !state.round) {
    return reject(409, 'GAME_NOT_STARTED', 'Oyun henüz başlamadı.');
  }
  const next = advanceDraw(state, privateState, nowMs).state;
  const nextPrivate = clone(privateState);
  if (next.phase === 'finished') return reject(409, 'GAME_FINISHED', 'Oyun tamamlandı.');

  if (envelope.type === ACTION_TYPES.RESIGN) {
    finishDraw(next, nowMs, { winnerKey: otherKey(actorKey), reason: 'resign' });
    return { ok: true, state: next, privateState: nextPrivate };
  }
  if (envelope.roundId !== next.round.id) return reject(409, 'STALE_ROUND', 'Bu tur artık açık değil.');
  if (nowMs < toMs(next.round.startedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem bu tur başlamadan ulaştı.');
  }
  const drawer = next.round.drawer;

  if (envelope.type === ACTION_TYPES.PICK) {
    if (actorKey !== drawer) return reject(409, 'NOT_DRAWER', 'Bu turda sen tahmin ediyorsun.');
    if (next.phase !== 'choosing') return reject(409, 'ROUND_NOT_CHOOSING', 'Kelime zaten seçildi.');
    const pick = envelope.optionIndex;
    if (!Number.isInteger(pick) || pick < 0 || pick > 2) {
      return reject(400, 'INVALID_OPTION', 'Üç kelimeden birini seç.');
    }
    startDrawing(next, nextPrivate, pick, nowMs);
    return { ok: true, state: next, privateState: nextPrivate };
  }

  if (envelope.type !== ACTION_TYPES.SOLVE && envelope.type !== ACTION_TYPES.REPORT) {
    return reject(400, 'INVALID_ACTION_FOR_GAME', 'Bu eylem Çiz Bil için geçerli değil.');
  }
  if (actorKey === drawer) return reject(409, 'NOT_GUESSER', 'Bu turda sen çiziyorsun.');
  if (next.phase !== 'drawing') return reject(409, 'ROUND_NOT_DRAWING', 'Çizim şu an açık değil.');
  if (nowMs < toMs(next.round.drawStartedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem çizim başlamadan ulaştı.');
  }

  if (envelope.type === ACTION_TYPES.REPORT) {
    closeRound(next, nextPrivate, nowMs, { reported: true });
    return { ok: true, state: next, privateState: nextPrivate };
  }

  const roundId = next.round.id;
  const counts = { ...(nextPrivate.guessCounts || {}) };
  const used = Number(counts[roundId]) || 0;
  if (used >= DRAW_MAX_GUESSES) return reject(429, 'TOO_MANY_GUESSES', 'Bu turdaki tahmin hakkın doldu.');
  counts[roundId] = used + 1;
  nextPrivate.guessCounts = counts;

  const word = pickedOf(next, nextPrivate).word;
  if (envelope.word === word) {
    closeRound(next, nextPrivate, nowMs, { solvedAtMs: nowMs });
    next.players[actorKey].answered = true;
    return { ok: true, state: next, privateState: nextPrivate };
  }
  next.round.guesses = [...next.round.guesses, { text: envelope.word, close: isCloseGuess(envelope.word, word) }];
  next.updatedAt = iso(nowMs);
  next.revision += 1;
  return { ok: true, state: next, privateState: nextPrivate };
};

/** The requesting player's private view of the current round. */
const actorDrawView = (state, privateState, actorKey) => {
  const round = state?.round;
  const entry = round && privateState?.rounds?.[round.index];
  if (!round || !entry || !playerKeys.includes(actorKey)) return null;
  if (actorKey !== round.drawer) return { roundId: round.id, role: 'guesser' };
  if (state.phase === 'choosing') {
    return {
      roundId: round.id,
      role: 'drawer',
      choices: entry.choices.map(({ word, difficulty }) => ({ word, difficulty })),
    };
  }
  const picked = pickedOf(state, privateState);
  return picked ? { roundId: round.id, role: 'drawer', word: picked.word } : { roundId: round.id, role: 'drawer' };
};

/** Who draws now, for the stroke channel: `{ roundId, drawer, open }`. */
const drawingTurn = (state, nowMs = Date.now()) => {
  const round = state?.round;
  if (!state || state.kind !== 'draw' || !round) return null;
  return {
    roundId: round.id,
    drawer: round.drawer,
    open: state.phase === 'drawing' && nowMs < toMs(round.endsAt),
  };
};

module.exports = {
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
  drawingTurn,
  isCloseGuess,
  startDrawState,
};
