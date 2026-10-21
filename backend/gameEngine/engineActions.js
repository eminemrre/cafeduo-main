/**
 * Shared action pipeline for competitive games (DB and memory paths).
 *
 * The caller owns the transaction/row lock or the in-process game lock; this
 * module only validates the actor, checks idempotency, applies the game rule
 * and reports the next persisted state.
 */

const { ACTION_TYPES, checkActionReceipt, recordActionReceipt } = require('./actionProtocol');
const { advanceQuiz, applyQuizAction } = require('./quizEngine');
const { advanceAim, applyAimAction } = require('./aimEngine');
const { AIM_GAME_TYPE, QUIZ_GAME_TYPE } = require('../../shared/gameRegistry');

const read = (game, camel, snake) => (game?.[camel] !== undefined ? game[camel] : game?.[snake]);

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const resolveActorKey = (actorName, game) => {
  const actor = normalize(actorName);
  if (!actor) return null;
  if (normalize(read(game, 'hostName', 'host_name')) === actor) return 'host';
  if (normalize(read(game, 'guestName', 'guest_name')) === actor) return 'guest';
  return null;
};

const gameTypeOf = (game) => String(read(game, 'gameType', 'game_type') || '').trim();

const resultOf = (state) => {
  if (state.phase !== 'finished') {
    return { status: 'active', winner: null };
  }
  return {
    status: 'finished',
    winner: state.result?.winner || null,
  };
};

/**
 * @returns {
 *   {ok: true, duplicate?: boolean, actorKey: string, state: object,
 *    privateState: object, status: string, winner: string|null} |
 *   {ok: false, status: number, code: string, message: string}
 * }
 */
const processCompetitiveAction = ({ game, actorName, envelope, nowMs = Date.now() }) => {
  const actorKey = resolveActorKey(actorName, game);
  if (!actorKey) {
    return {
      ok: false,
      status: 403,
      code: 'NOT_PARTICIPANT',
      message: 'Bu oyunun oyuncusu değilsin.',
    };
  }

  const gameType = gameTypeOf(game);
  if (gameType !== QUIZ_GAME_TYPE && gameType !== AIM_GAME_TYPE) {
    return {
      ok: false,
      status: 400,
      code: 'NOT_COMPETITIVE_GAME',
      message: 'Bu oyun eylem protokolünü kullanmıyor.',
    };
  }

  const rawState = read(game, 'gameState', 'game_state');
  const privateState = read(game, 'gamePrivateState', 'game_private_state');
  const state = rawState && typeof rawState === 'object' ? rawState.engine : null;

  if (!state || state.version !== 2 || !privateState || privateState.version !== 2) {
    return {
      ok: false,
      status: 409,
      code: 'ENGINE_STATE_MISSING',
      message: 'Oyun sunucu durumu hazır değil.',
    };
  }

  const receipt = checkActionReceipt({
    ledger: privateState.actions,
    actorKey,
    envelope,
  });
  if (receipt.status === 'conflict') {
    return {
      ok: false,
      status: 409,
      code: 'ACTION_ID_CONFLICT',
      message: 'Bu eylem kimliği farklı bir istek için kullanılmış.',
    };
  }
  if (receipt.status === 'duplicate') {
    return {
      ok: true,
      duplicate: true,
      actorKey,
      state,
      privateState,
      ...resultOf(state),
    };
  }

  if (gameType === QUIZ_GAME_TYPE) {
    const applied = applyQuizAction({
      state,
      privateState,
      actorKey,
      envelope,
      nowMs,
    });
    if (!applied.ok) return applied;

    const ledger = recordActionReceipt({
      ledger: privateState.actions,
      actorKey,
      envelope,
      receipt: {
        status: 'applied',
        revision: applied.state.revision,
        at: new Date(nowMs).toISOString(),
      },
    });
    return {
      ok: true,
      actorKey,
      state: applied.state,
      privateState: { ...applied.privateState, actions: ledger },
      ...resultOf(applied.state),
    };
  }

  if (gameType === AIM_GAME_TYPE) {
    const applied = applyAimAction({
      state,
      privateState,
      actorKey,
      envelope,
      nowMs,
    });
    if (!applied.ok) return applied;

    const ledger = recordActionReceipt({
      ledger: privateState.actions,
      actorKey,
      envelope,
      receipt: {
        status: 'applied',
        revision: applied.state.revision,
        at: new Date(nowMs).toISOString(),
      },
    });
    return {
      ok: true,
      actorKey,
      state: applied.state,
      privateState: { ...applied.privateState, actions: ledger },
      ...resultOf(applied.state),
    };
  }

  return {
    ok: false,
    status: 400,
    code: 'INVALID_ACTION_FOR_GAME',
    message: 'Bu eylem bu oyun için geçerli değil.',
  };
};

/**
 * Moves the public match clock forward without changing private state.
 * Used when a snapshot is read after a deadline passed.
 */
const syncCompetitiveGame = ({ game, nowMs = Date.now() }) => {
  const gameType = gameTypeOf(game);
  const rawState = read(game, 'gameState', 'game_state');
  const privateState = read(game, 'gamePrivateState', 'game_private_state');
  const state = rawState && typeof rawState === 'object' ? rawState.engine : null;

  if (
    !state ||
    state.version !== 2 ||
    !privateState ||
    privateState.version !== 2 ||
    state.phase === 'finished'
  ) {
    return { changed: false, state, status: null, winner: null };
  }

  let advanced = { state, changed: false };
  if (gameType === QUIZ_GAME_TYPE) {
    advanced = advanceQuiz(state, privateState, nowMs);
  } else if (gameType === AIM_GAME_TYPE) {
    advanced = advanceAim(state, privateState, nowMs);
  }

  if (!advanced.changed) {
    return {
      changed: false,
      state,
      status: null,
      winner: null,
    };
  }

  const result = resultOf(advanced.state);
  return {
    changed: true,
    state: advanced.state,
    status: result.status,
    winner: result.winner,
  };
};

module.exports = {
  ACTION_TYPES,
  processCompetitiveAction,
  resolveActorKey,
  syncCompetitiveGame,
};
