const GAME_STATUS = Object.freeze({
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHING: 'finishing',
  FINISHED: 'finished',
});

const VALID_STATUSES = Object.freeze(new Set(Object.values(GAME_STATUS)));

const TRANSITIONS = Object.freeze({
  [GAME_STATUS.WAITING]: new Set([GAME_STATUS.ACTIVE, GAME_STATUS.FINISHED]),
  [GAME_STATUS.ACTIVE]: new Set([GAME_STATUS.ACTIVE, GAME_STATUS.FINISHING, GAME_STATUS.FINISHED]),
  [GAME_STATUS.FINISHING]: new Set([GAME_STATUS.FINISHED]),
  [GAME_STATUS.FINISHED]: new Set([GAME_STATUS.FINISHED]),
});

const normalizeGameStatus = (rawStatus) => String(rawStatus || '').trim().toLowerCase();

const isValidStatus = (status) => VALID_STATUSES.has(normalizeGameStatus(status));

const canTransitionGameStatus = (fromStatus, toStatus) => {
  const from = normalizeGameStatus(fromStatus);
  const to = normalizeGameStatus(toStatus);
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  const allowed = TRANSITIONS[from];
  return Boolean(allowed && allowed.has(to));
};

const assertGameStatusTransition = ({ fromStatus, toStatus, context = 'game' }) => {
  const from = normalizeGameStatus(fromStatus);
  const to = normalizeGameStatus(toStatus);

  if (!isValidStatus(from)) {
    return {
      ok: false,
      code: 'invalid_game_status',
      message: `Geçersiz oyun durumu (${context}): "${String(fromStatus || '')}".`,
      from,
      to,
    };
  }

  if (!isValidStatus(to)) {
    return {
      ok: false,
      code: 'invalid_target_status',
      message: `Geçersiz hedef oyun durumu (${context}): "${String(toStatus || '')}".`,
      from,
      to,
    };
  }

  if (!canTransitionGameStatus(from, to)) {
    return {
      ok: false,
      code: 'invalid_status_transition',
      message: `Geçersiz oyun durumu geçişi (${context}): ${from} -> ${to}.`,
      from,
      to,
    };
  }

  return { ok: true, from, to };
};

module.exports = {
  GAME_STATUS,
  normalizeGameStatus,
  isValidStatus,
  canTransitionGameStatus,
  assertGameStatusTransition,
};
