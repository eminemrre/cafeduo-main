/**
 * The one table of competitive engines (protocol v2), keyed by game type.
 *
 * Create, join, the action endpoint, readers and the deadline job all reach a
 * game's rules through this table, so a new competitive game is one entry here
 * plus `competitive: true` in shared/gameRegistry.js, not another if-chain in
 * every handler.
 */

const {
  AIM_GAME_TYPE,
  BATTLESHIP_GAME_TYPE,
  COMPETITIVE_GAME_TYPES,
  QUIZ_GAME_TYPE,
} = require('../../shared/gameRegistry');
const {
  advanceQuiz,
  applyQuizAction,
  createQuizPrivateState,
  createQuizPublicState,
  startQuizState,
} = require('./quizEngine');
const {
  advanceAim,
  applyAimAction,
  createAimPrivateState,
  createAimPublicState,
  startAimState,
} = require('./aimEngine');
const {
  advanceBattleship,
  applyBattleshipAction,
  createBattleshipPrivateState,
  createBattleshipPublicState,
  startBattleshipState,
} = require('./battleshipEngine');

const nonEmpty = (value) => Array.isArray(value) && value.length > 0;

const ENGINES = Object.freeze({
  [QUIZ_GAME_TYPE]: Object.freeze({
    kind: 'quiz',
    createPrivateState: () => createQuizPrivateState(),
    isPrivateStateReady: (privateState) => nonEmpty(privateState?.questions),
    createPublicState: ({ hostName, guestName, privateState }) =>
      createQuizPublicState({ hostName, guestName, totalRounds: privateState.questions.length }),
    start: startQuizState,
    applyAction: applyQuizAction,
    advance: advanceQuiz,
  }),
  [AIM_GAME_TYPE]: Object.freeze({
    kind: 'aim',
    createPrivateState: () => createAimPrivateState(),
    isPrivateStateReady: (privateState) => nonEmpty(privateState?.rounds),
    createPublicState: ({ hostName, guestName, privateState }) =>
      createAimPublicState({ hostName, guestName, totalRounds: privateState.rounds.length }),
    start: startAimState,
    applyAction: applyAimAction,
    advance: advanceAim,
  }),
  [BATTLESHIP_GAME_TYPE]: Object.freeze({
    kind: 'battleship',
    createPrivateState: () => createBattleshipPrivateState(),
    isPrivateStateReady: (privateState) =>
      nonEmpty(privateState?.autoLayouts?.host) && nonEmpty(privateState?.autoLayouts?.guest),
    createPublicState: ({ hostName, guestName }) =>
      createBattleshipPublicState({ hostName, guestName }),
    start: startBattleshipState,
    applyAction: applyBattleshipAction,
    advance: advanceBattleship,
  }),
});

for (const gameType of COMPETITIVE_GAME_TYPES) {
  if (!ENGINES[gameType]) {
    throw new Error(`Competitive game type "${gameType}" has no engine`);
  }
}

const getEngine = (gameType) => ENGINES[String(gameType || '').trim()] || null;

/** Fresh private state for a new waiting game, or null for a non-engine game. */
const createEnginePrivateState = (gameType) => getEngine(gameType)?.createPrivateState() || null;

/** True when a waiting game's private state can start a match. */
const isEnginePrivateStateReady = (gameType, privateState) => {
  const engine = getEngine(gameType);
  return Boolean(
    engine && privateState && privateState.version === 2 && engine.isPrivateStateReady(privateState)
  );
};

/** The started public engine state for a game a guest just joined. */
const startEngineState = ({ gameType, privateState, hostName, guestName, nowMs = Date.now() }) => {
  const engine = getEngine(gameType);
  if (!engine) throw new Error(`No engine for game type "${gameType}"`);
  return engine.start({
    state: engine.createPublicState({ hostName, guestName, privateState }),
    privateState,
    hostName,
    guestName,
    nowMs,
  });
};

module.exports = {
  ENGINES,
  createEnginePrivateState,
  getEngine,
  isEnginePrivateStateReady,
  startEngineState,
};
