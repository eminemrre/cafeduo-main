/**
 * Wire format and idempotency for the v2 game action endpoint.
 *
 * Every action is identified by a client-generated `actionId` plus the
 * `roundId` it belongs to. Retrying the same action returns the stored
 * receipt; reusing the id for a different payload is a conflict. The client
 * timestamp is accepted for diagnostics only and never used for scoring —
 * the engine scores at the server receive time.
 */

const { createHash } = require('crypto');
const { CELL_COUNT, DIRECTIONS, FLEET } = require('../../shared/battleship');

const ACTION_TYPES = Object.freeze({
  ANSWER: 'answer',
  JOKER: 'joker',
  FIRE: 'fire',
  PLACE: 'place',
  RESIGN: 'resign',
});

const ACTION_TYPE_VALUES = Object.freeze(Object.values(ACTION_TYPES));
const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
// r1..r999: Amiral Battı numbers every turn (placement + up to 200 battle turns).
const ROUND_ID_PATTERN = /^r[1-9][0-9]{0,2}$/;
const MAX_OPTION_INDEX = 7;
const MAX_RECEIPTS_PER_PLAYER = 64;

const text = (value) => String(value ?? '').trim();

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const fingerprintAction = (envelope) =>
  createHash('sha256').update(stableStringify(envelope)).digest('hex').slice(0, 32);

/**
 * @returns {{ok: true, envelope: object} | {ok: false, code: string, message: string}}
 */
const normalizeActionEnvelope = (body) => {
  const actionId = text(body?.actionId);
  const roundId = text(body?.roundId);
  const type = text(body?.type).toLowerCase();

  if (!ACTION_ID_PATTERN.test(actionId)) {
    return {
      ok: false,
      code: 'INVALID_ACTION_ID',
      message: 'actionId 8-64 karakter olmalı (harf, rakam, _ veya -).',
    };
  }
  if (!ROUND_ID_PATTERN.test(roundId)) {
    return { ok: false, code: 'INVALID_ROUND_ID', message: 'roundId geçersiz.' };
  }
  if (!ACTION_TYPE_VALUES.includes(type)) {
    return { ok: false, code: 'INVALID_ACTION_TYPE', message: 'Bilinmeyen oyun eylemi.' };
  }

  const envelope = { actionId, roundId, type };

  if (type === ACTION_TYPES.ANSWER) {
    const optionIndex = Number(body?.optionIndex);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > MAX_OPTION_INDEX) {
      return { ok: false, code: 'INVALID_OPTION', message: 'Cevap seçeneği geçersiz.' };
    }
    envelope.optionIndex = optionIndex;
  }

  // Amiral Battı aims at a cell; Nişancı Düellosu sends no target at all.
  if (type === ACTION_TYPES.FIRE && body?.cell !== undefined && body?.cell !== null) {
    const cell = Number(body.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) {
      return { ok: false, code: 'INVALID_CELL', message: 'Atış karesi geçersiz.' };
    }
    envelope.cell = cell;
  }

  // Only the shape is checked here (and canonicalised for the fingerprint);
  // the engine checks bounds and overlaps with the shared rules.
  if (type === ACTION_TYPES.PLACE) {
    const layout = body?.layout;
    if (!Array.isArray(layout) || layout.length !== FLEET.length) {
      return { ok: false, code: 'INVALID_LAYOUT', message: 'Filo yerleşimi geçersiz.' };
    }
    const entries = [];
    for (const entry of layout) {
      const cell = Number(entry?.cell);
      const dir = text(entry?.dir).toLowerCase();
      if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT || !DIRECTIONS.includes(dir)) {
        return { ok: false, code: 'INVALID_LAYOUT', message: 'Filo yerleşimi geçersiz.' };
      }
      entries.push({ cell, dir });
    }
    envelope.layout = entries;
  }

  return { ok: true, envelope };
};

const getActorReceipts = (ledger, actorKey) => {
  const source = ledger && typeof ledger === 'object' ? ledger : {};
  const receipts = source[actorKey];
  return receipts && typeof receipts === 'object' ? receipts : {};
};

/**
 * @returns {{status: 'new'} | {status: 'duplicate', receipt: object} | {status: 'conflict'}}
 */
const checkActionReceipt = ({ ledger, actorKey, envelope }) => {
  const receipts = getActorReceipts(ledger, actorKey);
  const existing = receipts[envelope.actionId];
  if (!existing) return { status: 'new' };
  if (existing.fingerprint !== fingerprintAction(envelope)) return { status: 'conflict' };
  return { status: 'duplicate', receipt: existing };
};

/**
 * Returns a new ledger object (the engine stores it in private state).
 */
const recordActionReceipt = ({ ledger, actorKey, envelope, receipt }) => {
  const next = ledger && typeof ledger === 'object' ? { ...ledger } : {};
  const receipts = { ...(next[actorKey] || {}) };
  receipts[envelope.actionId] = {
    fingerprint: fingerprintAction(envelope),
    roundId: envelope.roundId,
    status: text(receipt?.status) || 'applied',
    code: receipt?.code || null,
    revision: Number(receipt?.revision || 0),
    at: text(receipt?.at) || new Date(0).toISOString(),
  };

  const ids = Object.keys(receipts);
  if (ids.length > MAX_RECEIPTS_PER_PLAYER) {
    for (const id of ids.slice(0, ids.length - MAX_RECEIPTS_PER_PLAYER)) {
      delete receipts[id];
    }
  }

  next[actorKey] = receipts;
  return next;
};

module.exports = {
  ACTION_ID_PATTERN,
  ACTION_TYPES,
  ACTION_TYPE_VALUES,
  MAX_OPTION_INDEX,
  MAX_RECEIPTS_PER_PLAYER,
  ROUND_ID_PATTERN,
  checkActionReceipt,
  fingerprintAction,
  normalizeActionEnvelope,
  recordActionReceipt,
  stableStringify,
};
