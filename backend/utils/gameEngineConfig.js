/**
 * Feature gate for the server-authoritative competitive engine (protocol v2).
 *
 * While the flag is off, the competitive games (Bilgi Yarışı, Nişancı Düellosu,
 * Amiral Battı: `competitive: true` in shared/gameRegistry.js) accept no new games.
 * The legacy score/live-submission protocol is rejected at every entry point, so
 * a half-deployed client/server pair can never produce a ranked result.
 *
 * Activation is an operational decision: set GAME_ENGINE_V2_ENABLED=true only
 * after both the backend and the new client are live.
 */

const { COMPETITIVE_GAME_TYPES } = require('../../shared/gameRegistry');

const COMPETITIVE_ENGINE_GAME_TYPES = COMPETITIVE_GAME_TYPES;

const isGameEngineV2Enabled = () => {
  const raw = String(process.env.GAME_ENGINE_V2_ENABLED || '')
    .trim()
    .toLowerCase();
  return raw === 'true' || raw === '1';
};

const isCompetitiveEngineGameType = (gameType) =>
  COMPETITIVE_ENGINE_GAME_TYPES.has(String(gameType || '').trim());

module.exports = {
  COMPETITIVE_ENGINE_GAME_TYPES,
  isGameEngineV2Enabled,
  isCompetitiveEngineGameType,
};
