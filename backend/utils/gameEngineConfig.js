/**
 * Feature gate for the server-authoritative competitive engine (protocol v2).
 *
 * While the flag is off, Bilgi Yarışı and Nişancı Düellosu accept no new games.
 * The legacy score/live-submission protocol is rejected at every entry point, so
 * a half-deployed client/server pair can never produce a ranked result.
 *
 * Activation is an operational decision: set GAME_ENGINE_V2_ENABLED=true only
 * after both the backend and the new client are live.
 */

const { AIM_GAME_TYPE, QUIZ_GAME_TYPE } = require('../../shared/gameRegistry');

const COMPETITIVE_ENGINE_GAME_TYPES = new Set([QUIZ_GAME_TYPE, AIM_GAME_TYPE]);

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
