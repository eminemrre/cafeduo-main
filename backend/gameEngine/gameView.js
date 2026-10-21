/**
 * Open-field serializers for every game response.
 *
 * The raw `games` row (and the in-memory game object) is never sent to a
 * client. Each surface picks from this allowlist instead, so adding a new
 * private column or engine key cannot leak it by accident.
 *
 * Private material from the v2 engine (answer key, future questions, action
 * ledger, bot plan) lives in `game_private_state` and is never part of a
 * game view.
 */

const { CHESS_GAME_TYPE, AIM_GAME_TYPE, QUIZ_GAME_TYPE } = require('../../shared/gameRegistry');
const { isCompetitiveEngineGameType } = require('../utils/gameEngineConfig');

const read = (game, camelKey, snakeKey) => {
  if (!game || typeof game !== 'object') return undefined;
  return game[camelKey] !== undefined ? game[camelKey] : game[snakeKey];
};

const readField = (game, key) => {
  if (key === 'table') {
    return read(game, 'table', 'table_code');
  }
  return read(
    game,
    key,
    key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  );
};

const cloneJson = (value) => {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
};

const pick = (source, keys) => {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = cloneJson(source[key]);
  }
  return out;
};

const isChessType = (gameType) => String(gameType || '').trim() === CHESS_GAME_TYPE;
const isAimType = (gameType) => String(gameType || '').trim() === AIM_GAME_TYPE;
const isQuizType = (gameType) => String(gameType || '').trim() === QUIZ_GAME_TYPE;

// Chess state is produced by the server (clock + engine). These keys are safe
// for both participants; anything else in the JSONB blob is not exposed.
const CHESS_STATE_KEYS = [
  'chess',
  'resolvedWinner',
  'stakeTransferred',
  'settlementApplied',
  'settledAt',
  'drawOffer',
  'lastMoveAt',
  'lastMove',
];

const PLAYER_KEYS = [
  'name',
  'score',
  'roundsWon',
  'correct',
  'streak',
  'hits',
  'answered',
  'jokerUsed',
  'left',
];
const PICK_KEYS = ['host', 'guest'];
const SHOT_KEYS = ['distance', 'points', 'position'];
const TRAJECTORY_KEYS = ['start', 'direction', 'speed', 'durationMs', 'rhythm'];
const ENGINE_STATE_KEYS = [
  'version',
  'kind',
  'revision',
  'phase',
  'roundIndex',
  'totalRounds',
  'startedAt',
  'phaseEndsAt',
  'updatedAt',
  'players',
  'round',
  'result',
];
const RESULT_KEYS = [
  'winner',
  'draw',
  'reason',
  'scores',
  'transferredPoints',
  'stakeTransferred',
  'cancelled',
  'maxScore',
  'settled',
  'settledAt',
];

const sanitizePlayer = (player) => pick(player, PLAYER_KEYS);

const sanitizeRound = (round) => {
  if (!round || typeof round !== 'object') return undefined;
  const out = {};
  for (const key of [
    'id',
    'index',
    'phase',
    'startedAt',
    'endsAt',
    'question',
    'category',
    'level',
  ]) {
    if (round[key] !== undefined) out[key] = cloneJson(round[key]);
  }
  if (Array.isArray(round.options)) {
    out.options = round.options.map((option) => String(option)).slice(0, 8);
  }
  if (round.correctIndex !== undefined && round.correctIndex !== null) {
    out.correctIndex = Number(round.correctIndex);
  }
  if (round.scoreDelta && typeof round.scoreDelta === 'object') {
    out.scoreDelta = pick(round.scoreDelta, PICK_KEYS);
  }
  if (round.picks && typeof round.picks === 'object') {
    out.picks = pick(round.picks, PICK_KEYS);
  }
  if (round.shots && typeof round.shots === 'object') {
    out.shots = {
      host: round.shots.host ? pick(round.shots.host, SHOT_KEYS) : null,
      guest: round.shots.guest ? pick(round.shots.guest, SHOT_KEYS) : null,
    };
  }
  if (round.trajectory && typeof round.trajectory === 'object') {
    out.trajectory = pick(round.trajectory, TRAJECTORY_KEYS);
  }
  return out;
};

const sanitizeEngineState = (engine) => {
  if (!engine || typeof engine !== 'object') return undefined;
  const out = pick(
    engine,
    ENGINE_STATE_KEYS.filter((key) => !['players', 'round', 'result'].includes(key))
  );

  if (engine.players && typeof engine.players === 'object') {
    out.players = {
      host: engine.players.host ? sanitizePlayer(engine.players.host) : null,
      guest: engine.players.guest ? sanitizePlayer(engine.players.guest) : null,
    };
  }
  const round = sanitizeRound(engine.round);
  if (round) out.round = round;
  if (engine.result && typeof engine.result === 'object') {
    out.result = pick(engine.result, RESULT_KEYS);
  }
  return out;
};

const serializeGameState = (gameType, rawState) => {
  const state = rawState && typeof rawState === 'object' ? rawState : {};

  if (isChessType(gameType)) {
    return pick(state, CHESS_STATE_KEYS);
  }

  if (isCompetitiveEngineGameType(gameType)) {
    // Ranked quiz/aim: only the engine's public view. Legacy blobs
    // (results/resolvedWinner/live/settlement fields) are dropped, because a
    // pre-v2 row may still contain client-written data.
    return state.engine ? { engine: sanitizeEngineState(state.engine) } : {};
  }

  return {};
};

const SERIALIZED_GAME_KEYS = [
  'id',
  'hostName',
  'gameType',
  'points',
  'table',
  'status',
  'guestName',
  'winner',
  'createdAt',
  'tournamentId',
];

const serializeGameForActor = (game, actorName, receivedAt) => {
  if (!game) return null;
  const gameType = String(read(game, 'gameType', 'game_type') || '').trim();
  const out = {};
  for (const key of SERIALIZED_GAME_KEYS) {
    const value = readField(game, key);
    if (value !== undefined) out[key] = cloneJson(value);
  }

  if (isChessType(gameType)) {
    const p1 = read(game, 'player1Move', 'player1_move');
    const p2 = read(game, 'player2Move', 'player2_move');
    if (p1 !== undefined) out.player1Move = cloneJson(p1);
    if (p2 !== undefined) out.player2Move = cloneJson(p2);
  }

  if (out.winner === undefined) out.winner = null;
  out.gameState = serializeGameState(gameType, read(game, 'gameState', 'game_state'));

  // Actor-only projection is deliberately outside the common gameState used
  // by sockets/history. Never infer the actor from a request payload.
  if (isQuizType(gameType) && actorName) {
    const actor = String(actorName).trim().toLowerCase();
    const key = ['host', 'guest'].find(
      (role) =>
        String(readField(game, `${role}Name`) || '')
          .trim()
          .toLowerCase() === actor
    );
    const joker = key && read(game, 'gamePrivateState', 'game_private_state')?.jokers?.[key];
    const round = out.gameState.engine?.round;
    if (joker && round?.id === joker.roundId && Array.isArray(joker.hidden)) {
      out.actorView = {
        joker: {
          roundId: joker.roundId,
          hiddenOptions: joker.hidden
            .filter(
              (index) =>
                Number.isInteger(index) && index >= 0 && index < (round.options?.length || 0)
            )
            .slice(0, 2),
        },
      };
    }
  }

  if (isCompetitiveEngineGameType(gameType)) {
    const engine = out.gameState.engine;
    out.protocolVersion = engine?.version === 2 ? 2 : 1;
    if (engine) {
      // Server clock for client-side countdown/trajectory rendering. The client
      // never writes game time; this only lets it estimate where the server
      // clock is before the next snapshot.
      out.serverNow = new Date().toISOString();
      if (Number.isFinite(receivedAt)) out.serverReceivedAt = new Date(receivedAt).toISOString();
    }
  }

  return out;
};

const serializeLobbyGame = (game) => {
  if (!game) return null;
  const out = {};
  for (const key of [
    'id',
    'hostName',
    'gameType',
    'points',
    'table',
    'status',
    'guestName',
    'createdAt',
  ]) {
    const value = readField(game, key);
    if (value !== undefined) out[key] = cloneJson(value);
  }
  return out;
};

module.exports = {
  CHESS_STATE_KEYS,
  ENGINE_STATE_KEYS,
  isAimType,
  isChessType,
  isQuizType,
  sanitizeEngineState,
  serializeGameForActor,
  serializeGameState,
  serializeLobbyGame,
};
