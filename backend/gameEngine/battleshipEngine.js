/**
 * Amiral Battı engine (protocol v2).
 *
 * Same shape as the quiz and aim engines: pure functions, the caller passes
 * the server clock and persists the returned states. The fleets, the seeded
 * auto layouts and the first turn live only in the private state; the public
 * state carries the shots fired at each side, sunk ship shapes and whose turn
 * it is.
 *
 * Rules (approved 2026-10-21): 8x8 board, fleet 4+3+3+2, 45 s placement (a
 * missing fleet is auto-placed from a seeded layout; a match nobody placed in
 * is abandoned), alternating 20 s turns with no extra shot on a hit, a missed
 * turn passes, three missed turns in a row forfeit, the first to sink the
 * whole fleet wins, and at the 128-turn cap more hits wins (equal is a draw).
 *
 * Every deadline is persisted. Catching up after a restart or a clock jump
 * replays turns from those deadlines, never from the reader's clock.
 */

const { randomInt: cryptoRandomInt } = require('crypto');
const {
  FLEET,
  FLEET_CELLS,
  MAX_BATTLE_TURNS,
  MAX_MISSED_TURNS,
  PLACEMENT_MS,
  TURN_MS,
  isCell,
  randomLayout,
  validateLayout,
} = require('../../shared/battleship');
const { ACTION_TYPES } = require('./actionProtocol');

const iso = (ms) => new Date(ms).toISOString();
const toMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const playerKeys = ['host', 'guest'];
const otherKey = (key) => (key === 'host' ? 'guest' : 'host');

const makePlayer = (name) => ({
  name: name || null,
  placed: false,
  autoPlaced: false,
  hits: 0,
  shots: 0,
  missedTurns: 0,
  answered: false,
  left: false,
});

const emptyBoard = () => ({ shots: [], sunk: [] });

const createBattleshipPrivateState = ({ randomInt = (max) => cryptoRandomInt(0, max) } = {}) => ({
  version: 2,
  kind: 'battleship',
  firstTurn: randomInt(2) === 0 ? 'host' : 'guest',
  autoLayouts: { host: randomLayout(randomInt), guest: randomLayout(randomInt) },
  fleets: { host: null, guest: null },
  placedAt: { host: null, guest: null },
  actions: { host: {}, guest: {} },
});

const createBattleshipPublicState = ({ hostName, guestName }) => ({
  version: 2,
  kind: 'battleship',
  revision: 0,
  phase: 'waiting',
  roundIndex: 0,
  totalRounds: MAX_BATTLE_TURNS + 1,
  startedAt: null,
  phaseEndsAt: null,
  updatedAt: iso(Date.now()),
  players: { host: makePlayer(hostName), guest: makePlayer(guestName) },
  round: null,
  boards: { host: emptyBoard(), guest: emptyBoard() },
  lastShot: null,
  result: null,
});

/** A side's ships: the placed fleet, or its seeded layout when it was auto-placed. */
const fleetOf = (privateState, key) => {
  const placed = privateState?.fleets?.[key];
  if (Array.isArray(placed) && placed.length) return placed;
  const auto = validateLayout(privateState?.autoLayouts?.[key]);
  return auto.ok ? auto.ships : [];
};

const openRound = (state, { phase, turn, atMs, durationMs }) => {
  const endsAt = atMs + durationMs;
  state.roundIndex += 1;
  state.phase = phase;
  state.phaseEndsAt = iso(endsAt);
  state.updatedAt = iso(atMs);
  state.round = {
    id: `r${state.roundIndex}`,
    index: state.roundIndex - 1,
    phase,
    turn: turn || null,
    startedAt: iso(atMs),
    endsAt: iso(endsAt),
  };
  state.revision += 1;
};

const battleTurnsUsed = (state) => Math.max(0, state.roundIndex - 1);

/**
 * Once a match is over both fleets are shown to both players (the ships that
 * were never found included). Only a fleet that was placed is shown: a side
 * that never placed has nothing to reveal, not its unused seeded layout.
 */
const revealFleets = (state, privateState) => {
  const reveal = {};
  for (const key of playerKeys) {
    reveal[key] = state.players[key]?.placed
      ? fleetOf(privateState, key).map(({ size, cells }) => ({ size, cells: [...cells] }))
      : [];
  }
  return reveal;
};

const finish = (state, privateState, { winnerKey = null, draw = false, reason, atMs }) => {
  state.phase = 'finished';
  state.reveal = revealFleets(state, privateState);
  state.phaseEndsAt = iso(atMs);
  state.updatedAt = iso(atMs);
  if (state.round) state.round.phase = 'finished';
  state.result = {
    winner: winnerKey ? state.players[winnerKey].name : null,
    draw: Boolean(draw),
    reason,
    scores: { host: state.players.host.hits, guest: state.players.guest.hits },
    maxScore: FLEET_CELLS,
  };
  state.revision += 1;
};

const finishOnHits = (state, privateState, atMs) => {
  const { host, guest } = state.players;
  const draw = host.hits === guest.hits;
  finish(state, privateState, {
    winnerKey: draw ? null : host.hits > guest.hits ? 'host' : 'guest',
    draw,
    reason: 'turn_limit',
    atMs,
  });
};

const nextTurn = (state, privateState, turnKey, atMs) => {
  if (battleTurnsUsed(state) >= MAX_BATTLE_TURNS) {
    finishOnHits(state, privateState, atMs);
    return;
  }
  openRound(state, { phase: 'battle', turn: turnKey, atMs, durationMs: TURN_MS });
};

const beginBattle = (state, privateState, atMs) => {
  const first = playerKeys.includes(privateState?.firstTurn) ? privateState.firstTurn : 'host';
  openRound(state, { phase: 'battle', turn: first, atMs, durationMs: TURN_MS });
};

const startBattleshipState = ({ state, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const next = clone(state);
  if (next.phase !== 'waiting') return next;
  if (
    !privateState ||
    !validateLayout(privateState.autoLayouts?.host).ok ||
    !validateLayout(privateState.autoLayouts?.guest).ok
  ) {
    throw new Error('Battleship private state has no auto layouts');
  }
  next.players.host = { ...makePlayer(hostName), ...next.players.host, name: hostName || null };
  next.players.guest = { ...makePlayer(guestName), ...next.players.guest, name: guestName || null };
  next.startedAt = iso(nowMs);
  openRound(next, { phase: 'placement', turn: null, atMs: nowMs, durationMs: PLACEMENT_MS });
  return next;
};

/** Applies one shot that the caller already validated; returns nothing. */
const resolveShot = (state, privateState, actorKey, cell, atMs) => {
  const targetKey = otherKey(actorKey);
  const board = state.boards[targetKey];
  const ships = fleetOf(privateState, targetKey);
  const ship = ships.find((candidate) => candidate.cells.includes(cell)) || null;
  const shooter = state.players[actorKey];

  board.shots.push({ cell, hit: Boolean(ship) });
  shooter.shots += 1;
  shooter.missedTurns = 0;
  let sunkSize = null;
  if (ship) {
    shooter.hits += 1;
    const hitCells = new Set(board.shots.filter((shot) => shot.hit).map((shot) => shot.cell));
    if (ship.cells.every((shipCell) => hitCells.has(shipCell))) {
      board.sunk.push({ size: ship.size, cells: [...ship.cells] });
      sunkSize = ship.size;
    }
  }
  state.lastShot = { by: actorKey, cell, hit: Boolean(ship), sunkSize, at: iso(atMs) };

  if (board.sunk.length >= ships.length && ships.length === FLEET.length) {
    finish(state, privateState, { winnerKey: actorKey, reason: 'fleet_sunk', atMs });
    return;
  }
  nextTurn(state, privateState, targetKey, atMs);
};

const advanceBattleship = (state, privateState, nowMs = Date.now()) => {
  if (
    !state ||
    state.kind !== 'battleship' ||
    state.phase === 'finished' ||
    state.phase === 'waiting'
  ) {
    return { state, changed: false };
  }
  const next = clone(state);
  let changed = false;

  // Bounded: the placement deadline plus every possible battle turn.
  for (let step = 0; step < MAX_BATTLE_TURNS + 2; step += 1) {
    if (!next.round || nowMs < toMs(next.round.endsAt)) break;
    const deadline = toMs(next.round.endsAt);

    if (next.phase === 'placement') {
      const anyPlaced = playerKeys.some((key) => next.players[key].placed);
      if (!anyPlaced) {
        finish(next, privateState, { draw: true, reason: 'abandoned', atMs: deadline });
        changed = true;
        break;
      }
      for (const key of playerKeys) {
        if (!next.players[key].placed) {
          next.players[key].placed = true;
          next.players[key].autoPlaced = true;
        }
      }
      beginBattle(next, privateState, deadline);
      changed = true;
      continue;
    }

    if (next.phase === 'battle') {
      const turnKey = next.round.turn;
      const player = next.players[turnKey];
      player.missedTurns += 1;
      next.lastShot = { by: turnKey, cell: null, hit: false, sunkSize: null, at: iso(deadline) };
      changed = true;
      if (player.missedTurns >= MAX_MISSED_TURNS) {
        finish(next, privateState, {
          winnerKey: otherKey(turnKey),
          reason: 'timeout',
          atMs: deadline,
        });
        break;
      }
      nextTurn(next, privateState, otherKey(turnKey), deadline);
      if (next.phase === 'finished') break;
      continue;
    }
    break;
  }

  return { state: changed ? next : state, changed };
};

const reject = (status, code, message) => ({ ok: false, status, code, message });

const applyBattleshipAction = ({ state, privateState, actorKey, envelope, nowMs = Date.now() }) => {
  if (!playerKeys.includes(actorKey)) {
    return reject(403, 'NOT_PARTICIPANT', 'Bu oyunun oyuncusu değilsin.');
  }
  if (!state || state.kind !== 'battleship' || !state.round) {
    return reject(409, 'GAME_NOT_STARTED', 'Oyun henüz başlamadı.');
  }

  const next = clone(advanceBattleship(state, privateState, nowMs).state);
  if (next.phase === 'finished') return reject(409, 'GAME_FINISHED', 'Oyun tamamlandı.');
  if (!next.round || envelope.roundId !== next.round.id) {
    return reject(409, 'STALE_ROUND', 'Bu tur artık açık değil.');
  }
  if (nowMs < toMs(next.round.startedAt)) {
    return reject(409, 'ACTION_BEFORE_ROUND', 'Eylem bu tur başlamadan ulaştı.');
  }

  const nextPrivate = clone(privateState);
  if (!nextPrivate.fleets || typeof nextPrivate.fleets !== 'object') {
    nextPrivate.fleets = { host: null, guest: null };
  }
  const player = next.players[actorKey];

  if (envelope.type === ACTION_TYPES.PLACE) {
    if (next.phase !== 'placement') {
      return reject(409, 'PLACEMENT_CLOSED', 'Yerleştirme süresi bitti.');
    }
    if (player.placed) return reject(409, 'ALREADY_PLACED', 'Filonu zaten yerleştirdin.');
    const layout = validateLayout(
      envelope.auto === true ? nextPrivate.autoLayouts[actorKey] : envelope.layout
    );
    if (!layout.ok) return reject(400, layout.code, layout.message);

    nextPrivate.fleets[actorKey] = layout.ships;
    nextPrivate.placedAt = { ...nextPrivate.placedAt, [actorKey]: iso(nowMs) };
    player.placed = true;
    player.autoPlaced = envelope.auto === true;
    player.answered = true;
    next.updatedAt = iso(nowMs);
    next.revision += 1;
    if (playerKeys.every((key) => next.players[key].placed)) {
      beginBattle(
        next,
        nextPrivate,
        Math.max(nowMs, ...Object.values(nextPrivate.placedAt).map(toMs))
      );
    }
    return { ok: true, state: next, privateState: nextPrivate };
  }

  if (envelope.type === ACTION_TYPES.FIRE) {
    if (next.phase !== 'battle') {
      return reject(409, 'NOT_BATTLE_PHASE', 'Henüz atış sırası başlamadı.');
    }
    if (next.round.turn !== actorKey) {
      return reject(409, 'NOT_YOUR_TURN', 'Sıra rakibinde.');
    }
    const cell = envelope.cell;
    if (!isCell(cell)) return reject(400, 'INVALID_CELL', 'Atış karesi geçersiz.');
    const targetBoard = next.boards[otherKey(actorKey)];
    if (targetBoard.shots.some((shot) => shot.cell === cell)) {
      return reject(409, 'CELL_ALREADY_SHOT', 'Bu kareye zaten ateş ettin.');
    }
    resolveShot(next, nextPrivate, actorKey, cell, nowMs);
    return { ok: true, state: next, privateState: nextPrivate };
  }

  if (envelope.type === ACTION_TYPES.RESIGN) {
    finish(next, nextPrivate, { winnerKey: otherKey(actorKey), reason: 'resign', atMs: nowMs });
    return { ok: true, state: next, privateState: nextPrivate };
  }

  return reject(400, 'INVALID_ACTION_FOR_GAME', 'Bu eylem Amiral Battı için geçerli değil.');
};

module.exports = {
  advanceBattleship,
  applyBattleshipAction,
  createBattleshipPrivateState,
  createBattleshipPublicState,
  fleetOf,
  startBattleshipState,
};
