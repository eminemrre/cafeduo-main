/**
 * Bilgi Yarışı engine (protocol v2).
 *
 * Pure, deterministic-in-time rules. Callers supply "now" (server clock) and
 * persist the returned public/private state. The public state never contains
 * an answer key; `privateState.questions[].answerIndex` and the per-round
 * responses stay in `games.game_private_state`.
 */

const { createHash, randomInt: cryptoRandomInt } = require('crypto');
const BANK = require('./data/quizQuestions.json');
const { ACTION_TYPES } = require('./actionProtocol');

const QUIZ_ROUND_COUNT = 10;
const QUIZ_QUESTION_SECONDS = 15;
const QUIZ_REVEAL_MS = 900;
const QUIZ_CORRECT_POINTS = 10;
const QUIZ_STREAK_BONUS = 5;
const QUIZ_STREAK_FROM = 3;

const iso = (ms) => new Date(ms).toISOString();
const toMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const playerKeys = ['host', 'guest'];

const assertBank = (bank) => {
  if (!Array.isArray(bank) || bank.length < QUIZ_ROUND_COUNT) {
    throw new Error('Quiz bank must contain at least 10 questions');
  }
  for (const entry of bank) {
    if (
      !entry ||
      typeof entry.question !== 'string' ||
      typeof entry.answer !== 'string' ||
      !Array.isArray(entry.wrong) ||
      entry.wrong.length !== 3 ||
      typeof entry.category !== 'string' ||
      !['orta', 'zor'].includes(entry.level)
    ) {
      throw new Error('Quiz bank contains an invalid entry');
    }
  }
};

const shuffleWith = (items, randomInt) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Draws a match set from every category in turn and shuffles the options.
 * `randomInt(maxExclusive)` is injectable for tests; production uses crypto.
 */
const buildQuizQuestions = ({
  bank = BANK,
  roundCount = QUIZ_ROUND_COUNT,
  randomInt = (max) => cryptoRandomInt(0, max),
} = {}) => {
  assertBank(bank);
  const count = Math.max(1, Math.min(bank.length, Math.floor(Number(roundCount) || 0)));
  const byCategory = new Map();
  for (const entry of bank) {
    const list = byCategory.get(entry.category) || [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }
  const piles = shuffleWith([...byCategory.values()], randomInt).map((pile) =>
    shuffleWith(pile, randomInt)
  );

  const picked = [];
  for (let turn = 0; picked.length < count; turn += 1) {
    const pile = piles[turn % piles.length];
    const entry = pile.pop();
    if (entry) picked.push(entry);
    if (piles.every((item) => item.length === 0)) break;
  }

  return picked.map((entry) => {
    const options = shuffleWith([entry.answer, ...entry.wrong], randomInt);
    return {
      question: entry.question,
      options,
      answerIndex: options.indexOf(entry.answer),
      category: entry.category,
      level: entry.level,
    };
  });
};

const createQuizPrivateState = (options = {}) => ({
  version: 2,
  kind: 'quiz',
  questions: buildQuizQuestions(options),
  responses: {},
  jokers: { host: null, guest: null },
  actions: { host: {}, guest: {} },
});

const makePlayer = (name) => ({
  name: String(name || '').trim() || null,
  score: 0,
  roundsWon: 0,
  correct: 0,
  streak: 0,
  answered: false,
  jokerUsed: false,
  left: false,
});

const createQuizPublicState = ({ hostName, guestName, totalRounds = QUIZ_ROUND_COUNT }) => ({
  version: 2,
  kind: 'quiz',
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

const openRound = (state, privateState, index, nowMs) => {
  const question = privateState.questions[index];
  if (!question) return false;
  const startedAt = nowMs;
  const endsAt = nowMs + QUIZ_QUESTION_SECONDS * 1000;
  state.phase = 'open';
  state.roundIndex = index + 1;
  state.phaseEndsAt = iso(endsAt);
  state.updatedAt = iso(nowMs);
  state.round = {
    id: `r${index + 1}`,
    index,
    startedAt: iso(startedAt),
    endsAt: iso(endsAt),
    question: question.question,
    options: [...question.options],
    category: question.category,
    level: question.level,
  };
  for (const key of playerKeys) {
    state.players[key].answered = false;
  }
  state.revision += 1;
  return true;
};

const startQuizState = ({ state, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const next = clone(state);
  if (next.phase === 'open' || next.phase === 'reveal' || next.phase === 'finished') {
    return next;
  }
  if (!privateState || !Array.isArray(privateState.questions) || !privateState.questions.length) {
    throw new Error('Quiz private state has no questions');
  }
  next.totalRounds = privateState.questions.length;
  next.players.host = { ...makePlayer(hostName), ...next.players.host, name: hostName || null };
  next.players.guest = { ...makePlayer(guestName), ...next.players.guest, name: guestName || null };
  next.startedAt = iso(nowMs);
  next.updatedAt = iso(nowMs);
  openRound(next, privateState, 0, nowMs);
  return next;
};

const scoreAnswer = ({ correct, secondsLeft, streakBefore, isFinal }) => {
  if (!correct) return { points: 0, timeBonus: 0, streakBonus: 0, doubled: false, streak: 0 };
  const streak = streakBefore + 1;
  const timeBonus = Math.max(0, Math.min(QUIZ_QUESTION_SECONDS, Math.floor(secondsLeft)));
  const streakBonus = streak >= QUIZ_STREAK_FROM ? QUIZ_STREAK_BONUS : 0;
  const subtotal = QUIZ_CORRECT_POINTS + timeBonus + streakBonus;
  return {
    points: isFinal ? subtotal * 2 : subtotal,
    timeBonus,
    streakBonus,
    doubled: isFinal,
    streak,
  };
};

const getRoundResponses = (privateState, roundId) => {
  const all =
    privateState?.responses && typeof privateState.responses === 'object'
      ? privateState.responses
      : {};
  const source = all[roundId];
  return source && typeof source === 'object' ? source : {};
};

const resolveRound = (state, privateState, nowMs) => {
  const round = state.round;
  if (!round) return false;
  const question = privateState.questions[round.index];
  if (!question) return false;
  const responses = getRoundResponses(privateState, round.id);

  const picks = { host: null, guest: null };
  const scoreDelta = { host: 0, guest: 0 };
  for (const actorKey of playerKeys) {
    const response = responses[actorKey];
    const player = state.players[actorKey];
    if (response) {
      picks[actorKey] = response.optionIndex;
      scoreDelta[actorKey] = Number(response.points || 0);
      player.score += Number(response.points || 0);
      player.correct += response.correct ? 1 : 0;
      player.roundsWon += response.correct ? 1 : 0;
      player.streak = Number(response.streak || 0);
      player.answered = true;
    } else {
      player.streak = 0;
      player.answered = false;
    }
  }

  round.correctIndex = question.answerIndex;
  round.picks = picks;
  round.scoreDelta = scoreDelta;
  state.phase = 'reveal';
  state.phaseEndsAt = iso(nowMs + QUIZ_REVEAL_MS);
  state.updatedAt = iso(nowMs);
  state.revision += 1;
  return true;
};

const finishQuiz = (state, nowMs) => {
  const host = state.players.host;
  const guest = state.players.guest;
  const draw = host.score === guest.score;
  state.phase = 'finished';
  state.phaseEndsAt = iso(nowMs);
  state.updatedAt = iso(nowMs);
  state.result = {
    winner: draw ? null : host.score > guest.score ? host.name : guest.name,
    draw,
    reason: 'rounds_complete',
    scores: { host: host.score, guest: guest.score },
  };
  state.revision += 1;
  return state;
};

/**
 * Moves the match clock forward: closes an expired or fully answered round,
 * reveals it, opens the next one, or finishes the match. Does not mutate the
 * arguments.
 */
const advanceQuiz = (state, privateState, nowMs = Date.now()) => {
  if (!state || state.kind !== 'quiz' || state.phase === 'finished' || state.phase === 'waiting') {
    return { state, changed: false };
  }
  const next = clone(state);
  let changed = false;

  // At most one open/reveal pair per match round. Never anchor a persisted
  // deadline to the time of a late reader, restart or worker tick.
  for (let step = 0; step < QUIZ_ROUND_COUNT; step += 1) {
    if (next.phase === 'open' && next.round) {
      const responses = getRoundResponses(privateState, next.round.id);
      const bothAnswered = Boolean(responses.host && responses.guest);
      if (bothAnswered || nowMs >= toMs(next.round.endsAt)) {
        const closedAt = bothAnswered
          ? Math.max(toMs(responses.host.receivedAt), toMs(responses.guest.receivedAt))
          : toMs(next.round.endsAt);
        resolveRound(next, privateState, closedAt);
        changed = true;
      }
    }

    if (next.phase === 'reveal' && nowMs >= toMs(next.phaseEndsAt)) {
      const nextIndex = next.roundIndex;
      const opensAt = toMs(next.phaseEndsAt);
      if (nextIndex >= next.totalRounds || !privateState.questions[nextIndex]) {
        finishQuiz(next, opensAt);
      } else {
        openRound(next, privateState, nextIndex, opensAt);
      }
      changed = true;
    } else break;
  }

  return { state: next, changed };
};

const reject = (status, code, message) => ({ ok: false, status, code, message });

const applyQuizAction = ({ state, privateState, actorKey, envelope, nowMs = Date.now() }) => {
  if (!playerKeys.includes(actorKey))
    return reject(403, 'NOT_PARTICIPANT', 'Bu oyunun oyuncusu değilsin.');
  if (!state || state.kind !== 'quiz' || !state.round) {
    return reject(409, 'GAME_NOT_STARTED', 'Oyun henüz başlamadı.');
  }

  const advanced = advanceQuiz(state, privateState, nowMs);
  const next = advanced.state;
  if (next.phase === 'finished') {
    return reject(409, 'GAME_FINISHED', 'Oyun tamamlandı.');
  }
  if (!next.round || envelope.roundId !== next.round.id) {
    return reject(409, 'STALE_ROUND', 'Bu tur artık açık değil.');
  }
  if (nowMs < toMs(next.round.startedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem bu tur başlamadan ulaştı.');
  }

  const nextPrivate = clone(privateState);
  const roundId = next.round.id;
  const responses = getRoundResponses(nextPrivate, roundId);
  const player = next.players[actorKey];

  if (envelope.type === ACTION_TYPES.ANSWER) {
    if (next.phase !== 'open') return reject(409, 'ROUND_CLOSED', 'Cevap süresi doldu.');
    if (responses[actorKey]) return reject(409, 'ALREADY_ANSWERED', 'Bu turda zaten cevap verdin.');
    if (envelope.optionIndex >= next.round.options.length) {
      return reject(400, 'INVALID_OPTION', 'Cevap seçeneği geçersiz.');
    }
    const question = nextPrivate.questions[next.round.index];
    const remainingMs = Math.max(0, toMs(next.round.endsAt) - nowMs);
    const secondsLeft = Math.min(QUIZ_QUESTION_SECONDS, Math.floor(remainingMs / 1000));
    const correct = envelope.optionIndex === question.answerIndex;
    const score = scoreAnswer({
      correct,
      secondsLeft,
      streakBefore: Number(player.streak || 0),
      isFinal: next.roundIndex === next.totalRounds,
    });

    responses[actorKey] = {
      optionIndex: envelope.optionIndex,
      receivedAt: iso(nowMs),
      secondsLeft,
      correct,
      points: score.points,
      timeBonus: score.timeBonus,
      streakBonus: score.streakBonus,
      doubled: score.doubled,
      streak: score.streak,
    };
    nextPrivate.responses[roundId] = responses;
    player.answered = true;
    next.updatedAt = iso(nowMs);
    next.revision += 1;

    const bothAnswered = Boolean(responses.host && responses.guest);
    const after = bothAnswered ? advanceQuiz(next, nextPrivate, nowMs).state : next;
    return { ok: true, state: after, privateState: nextPrivate };
  }

  if (envelope.type === ACTION_TYPES.JOKER) {
    if (next.phase !== 'open') return reject(409, 'ROUND_CLOSED', 'Cevap süresi doldu.');
    if (responses[actorKey])
      return reject(409, 'ALREADY_ANSWERED', 'Cevap verdikten sonra joker kullanılamaz.');
    if (nextPrivate.jokers && nextPrivate.jokers[actorKey]) {
      return reject(409, 'JOKER_USED', 'Joker bu maçta zaten kullanıldı.');
    }
    const question = nextPrivate.questions[next.round.index];
    const wrongIndexes = question.options
      .map((_option, index) => index)
      .filter((index) => index !== question.answerIndex);
    const seed = createHash('sha256').update(`${roundId}|${question.question}`).digest();
    const first = seed[0] % wrongIndexes.length;
    const second = (first + 1 + (seed[1] % (wrongIndexes.length - 1))) % wrongIndexes.length;
    const hidden = [wrongIndexes[first], wrongIndexes[second]].sort((a, b) => a - b);
    nextPrivate.jokers = { ...(nextPrivate.jokers || {}), [actorKey]: { roundId, hidden } };
    player.jokerUsed = true;
    next.updatedAt = iso(nowMs);
    next.revision += 1;
    return { ok: true, state: next, privateState: nextPrivate };
  }

  if (envelope.type === ACTION_TYPES.RESIGN) {
    const nextState = clone(next);
    const winnerKey = actorKey === 'host' ? 'guest' : 'host';
    nextState.phase = 'finished';
    nextState.phaseEndsAt = iso(nowMs);
    nextState.updatedAt = iso(nowMs);
    nextState.result = {
      winner: nextState.players[winnerKey].name,
      draw: false,
      reason: 'resign',
      scores: {
        host: nextState.players.host.score,
        guest: nextState.players.guest.score,
      },
    };
    nextState.revision += 1;
    return { ok: true, state: nextState, privateState: nextPrivate };
  }

  return reject(400, 'INVALID_ACTION_FOR_GAME', 'Bu eylem Bilgi Yarışı için geçerli değil.');
};

module.exports = {
  QUIZ_CORRECT_POINTS,
  QUIZ_QUESTION_SECONDS,
  QUIZ_REVEAL_MS,
  QUIZ_ROUND_COUNT,
  QUIZ_STREAK_BONUS,
  QUIZ_STREAK_FROM,
  advanceQuiz,
  applyQuizAction,
  buildQuizQuestions,
  createQuizPrivateState,
  createQuizPublicState,
  finishQuiz,
  scoreAnswer,
  startQuizState,
};
