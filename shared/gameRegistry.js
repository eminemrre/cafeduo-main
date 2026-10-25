/**
 * Single source of truth for cafeduo game types.
 *
 * Used by:
 *   - backend/utils/serverConfig.js (SUPPORTED_GAME_TYPES, normalizeGameType)
 *   - frontend components (ArenaBattle, KnowledgeQuiz, RetroChess, CreateGameModal)
 *
 * CommonJS export so that backend (Node CJS) and frontend (Vite/TS) can both
 * consume it without a build step. Type definitions live in `gameRegistry.d.ts`.
 */

const AIM_GAME_TYPE = 'Nişancı Düellosu';
const QUIZ_GAME_TYPE = 'Bilgi Yarışı';
const CHESS_GAME_TYPE = 'Retro Satranç';
const BATTLESHIP_GAME_TYPE = 'Amiral Battı';
const HANGMAN_GAME_TYPE = 'Adam Asmaca';

/** Canonical game definitions keyed by their display type. */
const GAME_REGISTRY = {
  [AIM_GAME_TYPE]: {
    type: AIM_GAME_TYPE,
    mode: 'aim',
    maxRounds: 5,
    maxScore: 15,
    minPoints: 40,
    submissionKeyPrefix: 'arena',
    competitive: true,
    category: 'Refleks',
    description: 'Nişangahı merkeze kilitle, tur tur isabet topla.',
  },
  [QUIZ_GAME_TYPE]: {
    type: QUIZ_GAME_TYPE,
    mode: 'quiz',
    maxRounds: 10,
    maxScore: 320,
    minPoints: 120,
    submissionKeyPrefix: 'quiz',
    competitive: true,
    category: 'Bilgi',
    description: 'Kısa bilgi sorularında doğru cevabı en hızlı ver.',
  },
  [CHESS_GAME_TYPE]: {
    type: CHESS_GAME_TYPE,
    mode: 'chess',
    maxRounds: null,
    maxScore: null,
    minPoints: 90,
    submissionKeyPrefix: 'chess',
    competitive: false,
    category: 'Strateji',
    description: 'Klasik 2 oyunculu satranç. Gerçek zamanlı ve hamle doğrulamalı.',
  },
  [BATTLESHIP_GAME_TYPE]: {
    type: BATTLESHIP_GAME_TYPE,
    mode: 'battleship',
    // Turn-based with a 128-turn cap (64 cells per player); no fixed round count.
    maxRounds: null,
    // Score is ship cells hit: 4 + 3 + 3 + 2.
    maxScore: 12,
    minPoints: 0,
    submissionKeyPrefix: 'battleship',
    competitive: true,
    category: 'Strateji',
    description: 'Filonu gizlice yerleştir, sırayla ateş et, rakip filoyu ilk sen batır.',
  },
  [HANGMAN_GAME_TYPE]: {
    type: HANGMAN_GAME_TYPE,
    mode: 'hangman',
    maxRounds: 3,
    // Per round at most 10 + 6 lives × 2 + 60 s / 6 = 32.
    maxScore: 96,
    minPoints: 0,
    submissionKeyPrefix: 'hangman',
    competitive: true,
    category: 'Kelime',
    description: 'Aynı gizli kelimeyi aynı anda çöz; az hatayla ve hızlı bulan kazanır.',
  },
};

const SUPPORTED_GAME_TYPES = new Set(Object.keys(GAME_REGISTRY));
/** Game types that run only on the server-authoritative v2 engine. */
const COMPETITIVE_GAME_TYPES = new Set(
  Object.values(GAME_REGISTRY)
    .filter((entry) => entry.competitive)
    .map((entry) => entry.type)
);
const GAME_TYPE_LIST = Object.values(GAME_REGISTRY);

/**
 * Authoritative score bounds of a game type, or null for an unknown type.
 * Submissions are clamped to these values instead of trusting the client.
 */
const getGameScoreBounds = (gameType) => {
  const entry = GAME_REGISTRY[String(gameType || '').trim()];
  if (!entry) return null;

  return {
    maxScore: typeof entry.maxScore === 'number' ? entry.maxScore : null,
    maxRounds: typeof entry.maxRounds === 'number' ? entry.maxRounds : null,
  };
};

/** Map of normalized slug → canonical game type. Used by serverConfig.normalizeGameType. */
const GAME_TYPE_ALIASES = {
  arena: AIM_GAME_TYPE,
  aim: AIM_GAME_TYPE,
  hedef: AIM_GAME_TYPE,
  nisanci: AIM_GAME_TYPE,
  nisanci_duellosu: AIM_GAME_TYPE,
  ni_anc_d_ellosu: AIM_GAME_TYPE,
  nisangah: AIM_GAME_TYPE,
  nisangah_ustasi: AIM_GAME_TYPE,
  rhythm: AIM_GAME_TYPE,
  ritim_kopyala: AIM_GAME_TYPE,
  tank: AIM_GAME_TYPE,
  tank_duellosu: AIM_GAME_TYPE,
  tank_d_ellosu: AIM_GAME_TYPE,
  chess: CHESS_GAME_TYPE,
  satranc: CHESS_GAME_TYPE,
  retro_satranc: CHESS_GAME_TYPE,
  strategy: CHESS_GAME_TYPE,
  knowledge: QUIZ_GAME_TYPE,
  quiz: QUIZ_GAME_TYPE,
  trivia: QUIZ_GAME_TYPE,
  bilgi: QUIZ_GAME_TYPE,
  bilgi_yarisi: QUIZ_GAME_TYPE,
  battleship: BATTLESHIP_GAME_TYPE,
  amiral: BATTLESHIP_GAME_TYPE,
  amiral_batti: BATTLESHIP_GAME_TYPE,
  amiral_batt: BATTLESHIP_GAME_TYPE,
  hangman: HANGMAN_GAME_TYPE,
  adam_asmaca: HANGMAN_GAME_TYPE,
  asmaca: HANGMAN_GAME_TYPE,
};

module.exports = {
  AIM_GAME_TYPE,
  QUIZ_GAME_TYPE,
  CHESS_GAME_TYPE,
  BATTLESHIP_GAME_TYPE,
  HANGMAN_GAME_TYPE,
  GAME_REGISTRY,
  SUPPORTED_GAME_TYPES,
  COMPETITIVE_GAME_TYPES,
  GAME_TYPE_LIST,
  GAME_TYPE_ALIASES,
  getGameScoreBounds,
};
