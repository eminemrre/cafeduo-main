/**
 * Nişancı Düellosu engine (protocol v2).
 *
 * Five rounds of 8 s, 750 ms result feedback. The server seeds the reticle
 * trajectory; a `fire` action carries no position or score. The score is
 * derived from the reticle position at the server receive time using the
 * shared pure trajectory function.
 */

const { randomInt: cryptoRandomInt } = require('crypto');
const {
  AIM_MAX_SCORE,
  AIM_REVEAL_MS,
  AIM_ROUND_COUNT,
  AIM_ROUND_MS,
  AIM_SPEED,
  AIM_START_MAX,
  AIM_START_MIN,
  createRhythm,
  pointsAt,
  positionAt,
} = require('../../shared/aimTrajectory');
const { ACTION_TYPES } = require('./actionProtocol');

const iso = (ms) => new Date(ms).toISOString();
const toMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const playerKeys = ['host', 'guest'];

const makeAimPlayer = (name) => ({
  name: String(name || '').trim() || null,
  score: 0,
  hits: 0,
  answered: false,
  left: false,
});

const createAimPrivateState = ({
  roundCount = AIM_ROUND_COUNT,
  randomInt = (max) => cryptoRandomInt(0, max),
} = {}) => {
  const count = Math.max(1, Math.floor(Number(roundCount) || 0));
  const rounds = [];
  for (let index = 0; index < count; index += 1) {
    rounds.push({
      trajectory: {
        start: AIM_START_MIN + randomInt(AIM_START_MAX - AIM_START_MIN + 1),
        direction: randomInt(2) === 0 ? 1 : -1,
        speed: AIM_SPEED,
        rhythm: createRhythm(randomInt),
      },
    });
  }
  return {
    version: 2,
    kind: 'aim',
    rounds,
    shots: {},
    actions: { host: {}, guest: {} },
  };
};

const createAimPublicState = ({ hostName, guestName, totalRounds = AIM_ROUND_COUNT }) => ({
  version: 2,
  kind: 'aim',
  revision: 0,
  phase: 'waiting',
  roundIndex: 0,
  totalRounds,
  startedAt: null,
  phaseEndsAt: null,
  updatedAt: iso(Date.now()),
  players: { host: makeAimPlayer(hostName), guest: makeAimPlayer(guestName) },
  round: null,
  result: null,
});

const openAimRound = (state, privateState, index, nowMs) => {
  const source = privateState.rounds[index];
  if (!source) return false;
  const endsAt = nowMs + AIM_ROUND_MS;
  state.phase = 'open';
  state.roundIndex = index + 1;
  state.phaseEndsAt = iso(endsAt);
  state.updatedAt = iso(nowMs);
  state.round = {
    id: `r${index + 1}`,
    index,
    startedAt: iso(nowMs),
    endsAt: iso(endsAt),
    trajectory: { ...source.trajectory },
  };
  for (const key of playerKeys) state.players[key].answered = false;
  state.revision += 1;
  return true;
};

const startAimState = ({ state, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const next = clone(state);
  if (next.phase === 'open' || next.phase === 'reveal' || next.phase === 'finished') {
    return next;
  }
  if (!privateState || !Array.isArray(privateState.rounds) || !privateState.rounds.length) {
    throw new Error('Aim private state has no rounds');
  }
  next.totalRounds = privateState.rounds.length;
  next.players.host = { ...makeAimPlayer(hostName), ...next.players.host, name: hostName || null };
  next.players.guest = {
    ...makeAimPlayer(guestName),
    ...next.players.guest,
    name: guestName || null,
  };
  next.startedAt = iso(nowMs);
  next.updatedAt = iso(nowMs);
  openAimRound(next, privateState, 0, nowMs);
  return next;
};

const getRoundShots = (privateState, roundId) => {
  const all =
    privateState?.shots && typeof privateState.shots === 'object' ? privateState.shots : {};
  const source = all[roundId];
  return source && typeof source === 'object' ? source : {};
};

const resolveAimRound = (state, privateState, nowMs) => {
  const round = state.round;
  if (!round) return false;
  const shots = getRoundShots(privateState, round.id);
  const publicShots = { host: null, guest: null };
  const scoreDelta = { host: 0, guest: 0 };

  for (const actorKey of playerKeys) {
    const shot = shots[actorKey];
    const player = state.players[actorKey];
    if (shot) {
      publicShots[actorKey] = { position: shot.position, points: shot.points };
      scoreDelta[actorKey] = Number(shot.points || 0);
      player.score += Number(shot.points || 0);
      player.hits += Number(shot.points || 0) > 0 ? 1 : 0;
      player.answered = true;
    } else {
      player.answered = false;
    }
  }

  round.shots = publicShots;
  round.scoreDelta = scoreDelta;
  state.phase = 'reveal';
  state.phaseEndsAt = iso(nowMs + AIM_REVEAL_MS);
  state.updatedAt = iso(nowMs);
  state.revision += 1;
  return true;
};

const finishAim = (state, nowMs) => {
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
    maxScore: AIM_MAX_SCORE,
  };
  state.revision += 1;
  return state;
};

const advanceAim = (state, privateState, nowMs = Date.now()) => {
  if (!state || state.kind !== 'aim' || state.phase === 'finished' || state.phase === 'waiting') {
    return { state, changed: false };
  }
  const next = clone(state);
  let changed = false;

  for (let step = 0; step < AIM_ROUND_COUNT; step += 1) {
    if (next.phase === 'open' && next.round) {
      const shots = getRoundShots(privateState, next.round.id);
      const bothFired = Boolean(shots.host && shots.guest);
      if (bothFired || nowMs >= toMs(next.round.endsAt)) {
        const closedAt = bothFired
          ? Math.max(toMs(shots.host.receivedAt), toMs(shots.guest.receivedAt))
          : toMs(next.round.endsAt);
        resolveAimRound(next, privateState, closedAt);
        changed = true;
      }
    }

    if (next.phase === 'reveal' && nowMs >= toMs(next.phaseEndsAt)) {
      const nextIndex = next.roundIndex;
      const opensAt = toMs(next.phaseEndsAt);
      if (nextIndex >= next.totalRounds || !privateState.rounds[nextIndex]) {
        finishAim(next, opensAt);
      } else {
        openAimRound(next, privateState, nextIndex, opensAt);
      }
      changed = true;
    } else break;
  }

  return { state: next, changed };
};

const reject = (status, code, message) => ({ ok: false, status, code, message });

const applyAimAction = ({ state, privateState, actorKey, envelope, nowMs = Date.now() }) => {
  if (!playerKeys.includes(actorKey))
    return reject(403, 'NOT_PARTICIPANT', 'Bu oyunun oyuncusu değilsin.');
  if (!state || state.kind !== 'aim' || !state.round) {
    return reject(409, 'GAME_NOT_STARTED', 'Oyun henüz başlamadı.');
  }

  const advanced = advanceAim(state, privateState, nowMs);
  const next = advanced.state;
  if (next.phase === 'finished') return reject(409, 'GAME_FINISHED', 'Oyun tamamlandı.');
  if (!next.round || envelope.roundId !== next.round.id) {
    return reject(409, 'STALE_ROUND', 'Bu tur artık açık değil.');
  }
  if (nowMs < toMs(next.round.startedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem bu tur başlamadan ulaştı.');
  }

  const nextPrivate = clone(privateState);
  const roundId = next.round.id;
  const shots = getRoundShots(nextPrivate, roundId);
  const player = next.players[actorKey];

  if (envelope.type === ACTION_TYPES.FIRE) {
    if (next.phase !== 'open') return reject(409, 'ROUND_CLOSED', 'Atış süresi doldu.');
    if (shots[actorKey]) return reject(409, 'ALREADY_FIRED', 'Bu turda zaten ateş ettin.');

    const elapsedMs = Math.max(0, nowMs - toMs(next.round.startedAt));
    const position = positionAt(next.round.trajectory, elapsedMs);
    const points = pointsAt(next.round.trajectory, elapsedMs);
    shots[actorKey] = {
      position,
      points,
      elapsedMs,
      receivedAt: iso(nowMs),
    };
    nextPrivate.shots[roundId] = shots;
    player.answered = true;
    next.updatedAt = iso(nowMs);
    next.revision += 1;

    const bothFired = Boolean(shots.host && shots.guest);
    const after = bothFired ? advanceAim(next, nextPrivate, nowMs).state : next;
    return { ok: true, state: after, privateState: nextPrivate };
  }

  if (envelope.type === ACTION_TYPES.RESIGN) {
    const finished = clone(next);
    const winnerKey = actorKey === 'host' ? 'guest' : 'host';
    finished.phase = 'finished';
    finished.phaseEndsAt = iso(nowMs);
    finished.updatedAt = iso(nowMs);
    finished.result = {
      winner: finished.players[winnerKey].name,
      draw: false,
      reason: 'resign',
      scores: {
        host: finished.players.host.score,
        guest: finished.players.guest.score,
      },
      maxScore: AIM_MAX_SCORE,
    };
    finished.revision += 1;
    return { ok: true, state: finished, privateState: nextPrivate };
  }

  return reject(400, 'INVALID_ACTION_FOR_GAME', 'Bu eylem Nişancı Düellosu için geçerli değil.');
};

module.exports = {
  AIM_MAX_SCORE,
  AIM_REVEAL_MS,
  AIM_ROUND_COUNT,
  AIM_ROUND_MS,
  advanceAim,
  applyAimAction,
  createAimPrivateState,
  createAimPublicState,
  finishAim,
  startAimState,
};
