# gameHandlers.js Refactoring Plan

## Executive Summary

[`backend/handlers/gameHandlers.js`](backend/handlers/gameHandlers.js:1) is 2287 lines and needs modularization. This document provides a comprehensive plan to split it into manageable, testable modules while maintaining backward compatibility and all existing tests (542/542 passing).

**Current State**: Monolithic file with 10 route handlers, 30+ utility functions  
**Target State**: Modular structure with ~400 lines per file maximum  
**Risk Level**: Medium (existing utilities extracted, tests comprehensive)  
**Estimated Complexity**: High - requires careful dependency management

---

## 1. Current Structure Analysis

### 1.1 File Metrics
- **Total Lines**: 2287
- **Route Handlers**: 10 (getGames, createGame, joinGame, getGameState, getUserGameHistory, makeMove, drawOffer, resignGame, finishGame, deleteGame)
- **Utility Functions**: ~35 functions
- **Dependencies**: 8 external modules
- **Test Coverage**: 854 lines of tests (backend/handlers/gameHandlers.test.js)

### 1.2 Function Categories

#### **Route Handlers (10 functions, ~1800 lines)**
1. [`getGames`](backend/handlers/gameHandlers.js:579) - List waiting games (46 lines)
2. [`createGame`](backend/handlers/gameHandlers.js:627) - Create new game (116 lines)
3. [`joinGame`](backend/handlers/gameHandlers.js:745) - Join waiting game (218 lines)
4. [`getGameState`](backend/handlers/gameHandlers.js:964) - Fetch game state with timeout check (133 lines)
5. [`getUserGameHistory`](backend/handlers/gameHandlers.js:1098) - Get user's finished games (96 lines)
6. [`makeMove`](backend/handlers/gameHandlers.js:1195) - External service (gameMoveService)
7. [`drawOffer`](backend/handlers/gameHandlers.js:1217) - Chess draw offer flow (462 lines)
8. [`resignGame`](backend/handlers/gameHandlers.js:1680) - Resign from active game (218 lines)
9. [`finishGame`](backend/handlers/gameHandlers.js:1899) - Finish game with settlement (317 lines)
10. [`deleteGame`](backend/handlers/gameHandlers.js:2217) - Delete game (52 lines)

#### **Chess Utilities (9 functions, ~235 lines)** ✅ Already extracted
- `isChessGameType` - Check if game is chess
- `normalizeChessClockConfig` - Normalize clock settings
- `activateChessClockState` - Activate clock on game start
- `createInitialChessState` - Create initial chess state
- `resolveParticipantColor` - Get player color (white/black)
- `sanitizeChessMovePayload` - Validate chess move
- `buildChessStateFromEngine` - Build state from chess.js
- `normalizeRuntimeChessClock` - Runtime clock normalization
- `buildChessTimeoutResolution` - Handle clock timeout

**Status**: Already in [`backend/handlers/game/chessUtils.js`](backend/handlers/game/chessUtils.js:1)

#### **Settlement Utilities (2 functions, ~170 lines)** ✅ Already extracted
- `applyDbSettlement` - Database point transfer
- `applyMemorySettlement` - In-memory point transfer

**Status**: Already in [`backend/handlers/game/settlementUtils.js`](backend/handlers/game/settlementUtils.js:1)

#### **Draw Offer Utilities (3 functions, ~30 lines)** ✅ Already extracted
- `normalizeDrawOfferAction` - Validate draw actions
- `normalizeDrawOffer` - Normalize draw offer object
- `findOpponentName` - Find opponent participant

**Status**: Already in [`backend/handlers/game/drawOfferUtils.js`](backend/handlers/game/drawOfferUtils.js:1)

#### **Emission Utilities (2 functions, ~20 lines)** ✅ Already extracted
- `emitRealtimeUpdate` - Emit to game room
- `emitLobbyUpdate` - Emit to all clients

**Status**: Already in [`backend/handlers/game/emissionUtils.js`](backend/handlers/game/emissionUtils.js:1)

#### **Validation Utilities (4 functions, ~100 lines)** 🔴 Still in main file
- `isAdminActor` - Check admin role
- `isNonCompetitiveGameType` - Check non-competitive game
- `sanitizeLiveSubmission` - Validate live score submission
- `normalizeParticipantKey` - Normalize participant name
- `mapTransitionError` - Format state transition errors

#### **Helper Utilities (7 functions, ~50 lines)** 🔴 Still in main file
- `nextChessResult` - Determine chess result
- `parseIsoTimestampMs` - Parse ISO timestamp
- Constants (CHESS_GAME_TYPE, NON_COMPETITIVE_GAME_TYPES, etc.)

### 1.3 External Dependencies

```javascript
const { Chess } = require('chess.js');
const { GAME_STATUS, assertGameStatusTransition, assertRequiredGameStatus, normalizeGameStatus } = require('../utils/gameStateMachine');
const { createGameMoveService } = require('../services/gameMoveService');
// Modular utilities (already extracted)
const { ... } = require('./game/chessUtils');
const { createEmissionUtils } = require('./game/emissionUtils');
const { ... } = require('./game/settlementUtils');
const { ... } = require('./game/drawOfferUtils');
```

### 1.4 Dependency Injection Pattern

The file uses a factory pattern [`createGameHandlers`](backend/handlers/gameHandlers.js:40) that accepts 16+ dependencies:
- Database: `pool`, `isDbConnected`
- Logging: `logger`
- Configuration: `supportedGameTypes`, `normalizeGameType`, `normalizeTableCode`
- Utilities: `getGameParticipants`, `normalizeParticipantName`, etc.
- Services: `gameService`, `lobbyCacheService`
- State: `getMemoryGames`, `setMemoryGames`, `getMemoryUsers`
- Socket.IO: `io`

---

## 2. Modular Architecture Design

### 2.1 Target Directory Structure

```
backend/handlers/game/
├── index.js                    # Main barrel export (new)
├── README.md                   # Documentation (update)
├── validation/
│   ├── index.js               # Validation barrel export
│   ├── gameValidation.js      # Game-level validation
│   └── participantValidation.js  # Participant validation
├── handlers/
│   ├── index.js               # Handler barrel export
│   ├── createGameHandler.js   # POST /games
│   ├── joinGameHandler.js     # POST /games/:id/join
│   ├── getGameStateHandler.js # GET /games/:id/state
│   ├── drawOfferHandler.js    # POST /games/:id/draw
│   ├── resignGameHandler.js   # POST /games/:id/resign
│   ├── finishGameHandler.js   # POST /games/:id/finish
│   ├── deleteGameHandler.js   # DELETE /games/:id
│   └── historyHandler.js      # GET /users/:username/games
├── utils/
│   ├── chessUtils.js          # ✅ Already exists
│   ├── settlementUtils.js     # ✅ Already exists
│   ├── drawOfferUtils.js      # ✅ Already exists
│   ├── emissionUtils.js       # ✅ Already exists
│   └── helperUtils.js         # New: misc helpers
└── __tests__/
    ├── handlers.test.js       # Handler tests
    ├── validation.test.js     # Validation tests
    └── integration.test.js    # Integration tests
```

### 2.2 Module Responsibilities

#### **validation/gameValidation.js** (~100 lines)
- `validateGameCreation(req, user)` - Validate create game request
- `validateGameJoin(game, user, stake)` - Validate join requirements
- `validateGameFinish(game, user, winner)` - Validate finish conditions
- `isAdminActor(user)` - Check admin privileges

#### **validation/participantValidation.js** (~80 lines)
- `normalizeParticipantKey(value)` - Normalize participant name
- `validateParticipantInGame(participant, game)` - Check participation
- `findOpponentName(participant, game)` - Find opponent
- `checkStakeRequirement(user, stake)` - Validate points

#### **handlers/createGameHandler.js** (~150 lines)
Handles: `POST /games`
- Parse and validate request
- Check for existing active games
- Create initial game state (chess clock if needed)
- Insert into DB/memory
- Emit lobby update
- Return created game

#### **handlers/joinGameHandler.js** (~180 lines)
Handles: `POST /games/:id/join`
- Validate join eligibility
- Check stake requirements
- Lock game record (FOR UPDATE)
- Activate chess clock if chess game
- Update game status to active
- Emit game and lobby updates

#### **handlers/getGameStateHandler.js** (~120 lines)
Handles: `GET /games/:id/state`
- Fetch game by ID
- Check authorization
- Detect chess timeout
- Auto-finish if timeout
- Return current state

#### **handlers/drawOfferHandler.js** (~350 lines)
Handles: `POST /games/:id/draw`
- Validate chess game and active status
- Handle actions: offer, accept, reject, cancel
- Manage pending offer state
- Apply settlement on acceptance
- Update game state
- Emit updates

#### **handlers/resignGameHandler.js** (~180 lines)
Handles: `POST /games/:id/resign`
- Validate active game
- Find opponent (becomes winner)
- Update game state
- Apply settlement
- Mark as finished
- Emit updates

#### **handlers/finishGameHandler.js** (~250 lines)
Handles: `POST /games/:id/finish`
- Validate finish conditions
- Resolve winner (state/results/manual)
- Handle already-finished games
- Apply settlement
- Update game status
- Emit updates

#### **handlers/deleteGameHandler.js** (~70 lines)
Handles: `DELETE /games/:id`
- Validate ownership/admin
- Delete from DB/memory
- Invalidate lobby cache
- Emit lobby update

#### **handlers/historyHandler.js** (~100 lines)
Handles: `GET /users/:username/games`
- Validate authorization
- Fetch finished games
- Map to history format
- Return sorted results

#### **utils/helperUtils.js** (~80 lines)
- `nextChessResult(chess)` - Determine result from chess.js
- `parseIsoTimestampMs(value)` - Parse ISO timestamp
- `sanitizeLiveSubmission(payload)` - Validate live submission
- Constants and shared utilities

---

## 3. Refactoring Plan

### Phase 1: Extract Remaining Utilities ⚡ Low Risk

**Goal**: Extract validation and helper utilities from main file

#### Step 1.1: Create validation modules
```bash
# Create validation directory
mkdir -p backend/handlers/game/validation
```

**Files to create**:
1. `backend/handlers/game/validation/gameValidation.js`
2. `backend/handlers/game/validation/participantValidation.js`
3. `backend/handlers/game/validation/index.js` (barrel export)

**Functions to extract**:
- From main file lines 58, 79-81: `isAdminActor`, `isNonCompetitiveGameType`
- From main file line 185: `sanitizeLiveSubmission`
- From main file line 361: `normalizeParticipantKey`
- From main file line 572: `mapTransitionError`

**Testing**: Run existing tests - should pass without changes

#### Step 1.2: Create helper utilities module
```bash
# Create utils/helperUtils.js
touch backend/handlers/game/utils/helperUtils.js
```

**Functions to extract**:
- From line 204: `nextChessResult`
- From line 245: `parseIsoTimestampMs`
- Constants: CHESS_GAME_TYPE, NON_COMPETITIVE_GAME_TYPES, CHESS_SQUARE_RE, DEFAULT_CHESS_CLOCK, CHESS_CLOCK_LIMITS, DRAW_OFFER_ACTIONS

**Testing**: Run existing tests - should pass without changes

#### Step 1.3: Update main file imports
- Import extracted utilities at top of gameHandlers.js
- Replace inline definitions with imported versions
- Run tests: `npm test backend/handlers/gameHandlers.test.js`

**Success Criteria**: All tests pass (542/542)

---

### Phase 2: Extract Route Handlers 🔶 Medium Risk

**Goal**: Split each route handler into separate file

#### Step 2.1: Create handlers directory structure
```bash
mkdir -p backend/handlers/game/handlers
```

#### Step 2.2: Extract handlers one-by-one (iterative approach)

**Order** (simplest to most complex):
1. ✅ `deleteGameHandler.js` (52 lines, minimal dependencies)
2. ✅ `historyHandler.js` (96 lines, read-only)
3. ✅ `getGameStateHandler.js` (133 lines, timeout logic)
4. ✅ `createGameHandler.js` (116 lines, chess clock init)
5. ✅ `resignGameHandler.js` (218 lines, settlement)
6. ✅ `joinGameHandler.js` (218 lines, state activation)
7. ✅ `finishGameHandler.js` (317 lines, complex validation)
8. ✅ `drawOfferHandler.js` (462 lines, state machine)

**For each handler**:

##### Extract Process
```javascript
// 1. Create new file: backend/handlers/game/handlers/[name]Handler.js
// 2. Import dependencies
const { GAME_STATUS, assertGameStatusTransition } = require('../../utils/gameStateMachine');
const { applyDbSettlement, applyMemorySettlement } = require('../utils/settlementUtils');
// ... etc

// 3. Create factory function
const create[Name]Handler = (deps) => {
  const { pool, isDbConnected, logger, ... } = deps;
  
  return async (req, res) => {
    // Handler implementation
  };
};

module.exports = { create[Name]Handler };

// 4. Update gameHandlers.js
const { create[Name]Handler } = require('./game/handlers/[name]Handler');
// ...
const [name]Handler = create[Name]Handler(dependencies);
return {
  [name]: [name]Handler,
  // ... other handlers
};
```

##### Testing After Each Extraction
```bash
# Run specific test case
npm test -- backend/handlers/gameHandlers.test.js -t "[handler name]"

# Run all handler tests
npm test backend/handlers/gameHandlers.test.js
```

##### Rollback Strategy
If tests fail:
1. Check console output for specific failure
2. Compare extracted handler with original
3. Fix missing dependencies or logic
4. If unresolvable, revert file and document issue

**Success Criteria per handler**: All related tests pass

---

### Phase 3: Update Main File Structure 🔶 Medium Risk

**Goal**: Transform gameHandlers.js into thin orchestrator

#### Step 3.1: Simplify main file
After all extractions, `backend/handlers/gameHandlers.js` should be ~200 lines:

```javascript
// Dependencies
const { createGameMoveService } = require('../services/gameMoveService');

// Handler imports
const { createGetGamesHandler } = require('./game/handlers/getGamesHandler');
const { createCreateGameHandler } = require('./game/handlers/createGameHandler');
const { createJoinGameHandler } = require('./game/handlers/joinGameHandler');
// ... etc

const createGameHandlers = (deps) => {
  // Initialize all handlers with dependencies
  const getGames = createGetGamesHandler(deps);
  const createGame = createCreateGameHandler(deps);
  const joinGame = createJoinGameHandler(deps);
  // ... etc
  
  // makeMove comes from external service
  const { makeMove } = createGameMoveService({
    pool: deps.pool,
    isDbConnected: deps.isDbConnected,
    // ... pass dependencies
  });
  
  return {
    getGames,
    createGame,
    joinGame,
    getGameState,
    getUserGameHistory,
    makeMove,
    drawOffer,
    resignGame,
    finishGame,
    deleteGame,
  };
};

module.exports = { createGameHandlers };
```

#### Step 3.2: Update barrel export
Update `backend/handlers/game/index.js`:

```javascript
// Utilities
const chessUtils = require('./utils/chessUtils');
const settlementUtils = require('./utils/settlementUtils');
const drawOfferUtils = require('./utils/drawOfferUtils');
const emissionUtils = require('./utils/emissionUtils');
const helperUtils = require('./utils/helperUtils');

// Validation
const validation = require('./validation');

// Handlers
const handlers = require('./handlers');

module.exports = {
  ...chessUtils,
  ...settlementUtils,
  ...drawOfferUtils,
  ...emissionUtils,
  ...helperUtils,
  ...validation,
  handlers,
};
```

**Testing**: Run full test suite
```bash
npm test backend/handlers/gameHandlers.test.js
```

**Success Criteria**: All 542 tests pass

---

### Phase 4: Test Migration & Enhancement 🟢 Low Risk

**Goal**: Organize tests by module

#### Step 4.1: Create test structure
```bash
mkdir -p backend/handlers/game/__tests__
```

#### Step 4.2: Split test file
Current `backend/handlers/gameHandlers.test.js` (854 lines) can be split:

1. `handlers.integration.test.js` - Keep full integration tests
2. `handlers.unit.test.js` - Add unit tests for individual handlers
3. `validation.test.js` - Test validation modules
4. `utils.test.js` - Test utility functions

**Note**: Keep original test file during migration for safety

#### Step 4.3: Add module-specific tests
For each new module, add focused tests:
- `chessUtils.test.js` - Chess-specific logic
- `settlementUtils.test.js` - Point transfer logic
- `drawOfferUtils.test.js` - Draw offer state machine

**Success Criteria**: Test coverage maintained or improved

---

### Phase 5: Documentation & Cleanup 🟢 Low Risk

#### Step 5.1: Update documentation
Files to update:
1. `backend/handlers/game/README.md` - Architecture overview
2. `docs/GAMEHANDLERS_REFACTORING_PLAN.md` - This file (mark as completed)
3. `AGENTS.md` - Add new file structure notes
4. Add JSDoc comments to all extracted modules

#### Step 5.2: Remove deprecated code
- Remove `imported*` prefixed imports from gameHandlers.js
- Remove duplicate utility definitions
- Verify no dead code remains

#### Step 5.3: Performance check
```bash
# Run full test suite
npm test

# Check for performance regressions
npm run test:performance  # if exists
```

---

## 4. Dependency Management

### 4.1 Shared Dependencies Matrix

| Module | pool | isDbConnected | logger | gameService | lobbyCacheService | io |
|--------|------|---------------|--------|-------------|-------------------|-----|
| createGameHandler | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| joinGameHandler | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| getGameStateHandler | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| drawOfferHandler | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| resignGameHandler | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| finishGameHandler | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| deleteGameHandler | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| historyHandler | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### 4.2 Dependency Injection Strategy

Each handler receives full dependency object:

```javascript
const createHandlerName = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    supportedGameTypes,
    normalizeGameType,
    normalizeTableCode,
    getGameParticipants,
    normalizeParticipantName,
    sanitizeScoreSubmission,
    pickWinnerFromResults,
    gameService,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    io,
  } = deps;
  
  // Handler implementation with access to all deps
  return async (req, res) => { /* ... */ };
};
```

**Benefits**:
- Single source of truth for dependencies
- Easy to mock for testing
- Clear dependency requirements

---

## 5. Testing Strategy

### 5.1 Test Preservation

**Critical**: All existing tests must pass throughout refactoring

Current test file: [`backend/handlers/gameHandlers.test.js`](backend/handlers/gameHandlers.test.js:1)
- **Lines**: 854
- **Test cases**: ~30 scenarios
- **Coverage**: All major flows

### 5.2 Test Approach by Phase

#### Phase 1 (Utility Extraction)
```bash
# After each utility extraction
npm test -- backend/handlers/gameHandlers.test.js

# Should see: PASS (all tests)
```

#### Phase 2 (Handler Extraction)
```bash
# After each handler extraction
npm test -- backend/handlers/gameHandlers.test.js

# Run specific handler tests
npm test -- backend/handlers/gameHandlers.test.js -t "creates game"
npm test -- backend/handlers/gameHandlers.test.js -t "joins game"
```

#### Phase 3 (Integration)
```bash
# Full test suite
npm test

# Check for regressions
npm test -- --coverage
```

### 5.3 Test Cases Coverage

Existing tests cover:
- ✅ Game creation with check-in validation
- ✅ Chess clock configuration
- ✅ Game joining (waiting → active)
- ✅ Rejoin active game
- ✅ Chess move validation and turn order
- ✅ Chess timeout detection
- ✅ Draw offer flow (offer → accept/reject/cancel)
- ✅ Resign with settlement
- ✅ Score submission and winner resolution
- ✅ Game finish with settlement
- ✅ Game deletion with authorization
- ✅ User game history
- ✅ State transition validation
- ✅ Admin override capabilities

**No new test cases needed initially** - refactoring maintains behavior

### 5.4 Continuous Verification

```bash
# Watch mode during development
npm test -- --watch backend/handlers/gameHandlers.test.js

# Pre-commit hook
npm test && npm run lint
```

---

## 6. Migration Checklist

### Pre-Migration
- [ ] Create feature branch: `git checkout -b refactor/gamehandlers-modular`
- [ ] Backup current test results: `npm test > tests-baseline.txt`
- [ ] Document current line count: `wc -l backend/handlers/gameHandlers.js`
- [ ] Review AGENTS.md rules

### Phase 1: Utilities
- [ ] Create `validation/gameValidation.js`
- [ ] Create `validation/participantValidation.js`
- [ ] Create `validation/index.js`
- [ ] Create `utils/helperUtils.js`
- [ ] Update imports in gameHandlers.js
- [ ] Run tests: `npm test backend/handlers/gameHandlers.test.js`
- [ ] Commit: `git commit -m "refactor: extract validation and helper utilities"`

### Phase 2: Handlers (one per commit)
- [ ] Extract deleteGameHandler.js → Test → Commit
- [ ] Extract historyHandler.js → Test → Commit
- [ ] Extract getGameStateHandler.js → Test → Commit
- [ ] Extract createGameHandler.js → Test → Commit
- [ ] Extract resignGameHandler.js → Test → Commit
- [ ] Extract joinGameHandler.js → Test → Commit
- [ ] Extract finishGameHandler.js → Test → Commit
- [ ] Extract drawOfferHandler.js → Test → Commit

### Phase 3: Integration
- [ ] Simplify gameHandlers.js to orchestrator
- [ ] Update barrel exports
- [ ] Run full test suite: `npm test`
- [ ] Check test count: Should still be 542/542
- [ ] Commit: `git commit -m "refactor: complete handler extraction"`

### Phase 4: Tests
- [ ] Create test structure in `__tests__/`
- [ ] Add unit tests for new modules
- [ ] Verify coverage maintained
- [ ] Commit: `git commit -m "test: reorganize and enhance tests"`

### Phase 5: Documentation
- [ ] Update README.md
- [ ] Add JSDoc comments
- [ ] Update AGENTS.md
- [ ] Final commit: `git commit -m "docs: update refactoring documentation"`

### Post-Migration
- [ ] Final test run: `npm test`
- [ ] Performance check
- [ ] Code review
- [ ] Merge to main

---

## 7. Risks & Mitigation

### Risk 1: Breaking Existing Tests 🔴 HIGH
**Impact**: Tests fail after extraction  
**Probability**: Medium  
**Mitigation**:
- Extract one handler at a time
- Run tests after each extraction
- Use git commits for easy rollback
- Keep original file until all tests pass

### Risk 2: Missing Dependencies 🟡 MEDIUM
**Impact**: Handler can't access required services  
**Probability**: Medium  
**Mitigation**:
- Pass full dependency object to each handler
- Document dependency requirements
- Use TypeScript types (if migrating later)
- Test both DB and memory modes

### Risk 3: State Machine Complexity 🟡 MEDIUM
**Impact**: Game state transitions break  
**Probability**: Low  
**Mitigation**:
- Keep state machine logic in utils/gameStateMachine.js
- Don't modify state transition logic
- Test all status transitions
- Reference existing tests for expected behavior

### Risk 4: Socket.IO Emission Timing 🟡 MEDIUM
**Impact**: Real-time updates don't fire  
**Probability**: Low  
**Mitigation**:
- Keep emissionUtils.js unchanged
- Ensure io instance passed to all handlers
- Test with integration tests
- Monitor Socket.IO events in development

### Risk 5: Memory vs Database Divergence 🟠 MEDIUM-LOW
**Impact**: DB mode works but memory mode breaks  
**Probability**: Low  
**Mitigation**:
- Test both modes explicitly
- Use same validation logic for both
- Keep getMemoryGames/setMemoryGames consistent
- Add specific memory mode tests

### Risk 6: Performance Regression 🟢 LOW
**Impact**: Handlers slower after extraction  
**Probability**: Very Low  
**Mitigation**:
- Function calls have minimal overhead
- No additional database queries added
- Keep caching logic unchanged
- Benchmark critical paths

### Risk 7: Merge Conflicts 🟢 LOW
**Impact**: Conflicts with concurrent development  
**Probability**: Low (if done quickly)  
**Mitigation**:
- Communicate refactoring plan to team
- Work in focused sprint
- Keep feature branch up to date
- Use small, atomic commits

---

## 8. Success Criteria

### Functional Requirements
✅ All 542 existing tests pass  
✅ No breaking changes to API  
✅ Game creation works (DB & memory)  
✅ Game joining works (DB & memory)  
✅ Chess moves and timeout detection work  
✅ Draw offer flow works  
✅ Resign and finish work with settlement  
✅ Real-time updates emit correctly  
✅ Admin overrides still function  

### Non-Functional Requirements
✅ Main file reduced to <400 lines  
✅ Each handler file <400 lines  
✅ Each utility module <300 lines  
✅ Test coverage maintained ≥90%  
✅ All functions have JSDoc comments  
✅ No duplicate code  
✅ Clear module boundaries  
✅ Easy to locate specific logic  

### Quality Metrics
- **Cyclomatic Complexity**: Reduce from ~150 to <10 per function
- **Maintainability Index**: Increase from ~45 to >65
- **Code Duplication**: Reduce from ~15% to <5%
- **Test-to-Code Ratio**: Maintain ~0.4

---

## 9. Timeline Estimate

### Conservative Estimate (3-4 days)
- **Phase 1** (Utilities): 4 hours
- **Phase 2** (Handlers): 16 hours (2 hours per handler)
- **Phase 3** (Integration): 4 hours
- **Phase 4** (Tests): 4 hours
- **Phase 5** (Documentation): 2 hours
- **Buffer**: 2 hours

**Total**: 32 hours (~4 working days)

### Aggressive Estimate (1-2 days)
- **Phase 1**: 2 hours
- **Phase 2**: 8 hours (1 hour per handler, parallel work)
- **Phase 3**: 2 hours
- **Phase 4**: 2 hours
- **Phase 5**: 1 hour
- **Buffer**: 1 hour

**Total**: 16 hours (~2 working days)

**Recommended**: Use conservative estimate for first-time refactoring

---

## 10. Example: extracting deleteGameHandler

### Before (in gameHandlers.js)
```javascript
const deleteGame = async (req, res) => {
  const { id } = req.params;

  if (await isDbConnected()) {
    const result = await pool.query(
      `DELETE FROM games WHERE id = $1 AND (LOWER(host_name) = LOWER($2) OR LOWER(COALESCE(guest_name, '')) = LOWER($2) OR $3 = true) RETURNING id`,
      [id, req.user?.username || '', isAdminActor(req.user)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
    }
    
    lobbyCacheService?.onGameDeleted({ tableCode: result.rows[0]?.table }).catch((err) => {
      logger.warn(`Cache invalidation failed on game deleted: ${err.message}`);
    });
    
    emitLobbyUpdate({ action: 'game_deleted', gameId: id });
    return res.json({ success: true });
  }

  // Memory mode logic...
};
```

### After (backend/handlers/game/handlers/deleteGameHandler.js)
```javascript
const { createEmissionUtils } = require('../utils/emissionUtils');

const createDeleteGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    io,
  } = deps;

  const { emitLobbyUpdate } = createEmissionUtils(io);
  const isAdminActor = (user) => user?.role === 'admin' || user?.isAdmin === true;

  return async (req, res) => {
    const { id } = req.params;

    if (await isDbConnected()) {
      const result = await pool.query(
        `DELETE FROM games WHERE id = $1 AND (LOWER(host_name) = LOWER($2) OR LOWER(COALESCE(guest_name, '')) = LOWER($2) OR $3 = true) RETURNING id`,
        [id, req.user?.username || '', isAdminActor(req.user)]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
      }
      
      lobbyCacheService?.onGameDeleted({ tableCode: result.rows[0]?.table }).catch((err) => {
        logger.warn(`Cache invalidation failed on game deleted: ${err.message}`);
      });
      
      emitLobbyUpdate({ action: 'game_deleted', gameId: id });
      return res.json({ success: true });
    }

    const currentGames = getMemoryGames();
    const nextGames = currentGames.filter((game) => {
      if (String(game.id) !== String(id)) return true;
      if (isAdminActor(req.user)) return false;
      const actor = String(req.user?.username || '').toLowerCase();
      return String(game.hostName || '').toLowerCase() !== actor && String(game.guestName || '').toLowerCase() !== actor;
    });
    
    if (nextGames.length === currentGames.length) {
      return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
    }
    
    setMemoryGames(nextGames);
    emitLobbyUpdate({ action: 'game_deleted', gameId: id });
    return res.json({ success: true });
  };
};

module.exports = { createDeleteGameHandler };
```

### Updated gameHandlers.js
```javascript
const { createDeleteGameHandler } = require('./game/handlers/deleteGameHandler');

const createGameHandlers = (deps) => {
  // ... other handlers
  
  const deleteGame = createDeleteGameHandler(deps);
  
  return {
    // ... other exports
    deleteGame,
  };
};
```

---

## 11. Maintenance Guidelines

### Adding New Handlers
1. Create new file in `backend/handlers/game/handlers/`
2. Follow factory pattern: `createNewHandler(deps)`
3. Import dependencies at module level
4. Export factory function
5. Add to main gameHandlers.js
6. Write tests in `__tests__/`

### Modifying Handlers
1. Locate handler in `handlers/` directory
2. Make changes with tests
3. Run handler-specific tests
4. Update JSDoc if signature changes

### Adding Utilities
1. Determine category (chess, validation, settlement, etc.)
2. Add to appropriate module
3. Export from module index.js
4. Write unit tests
5. Document in README.md

### Code Review Checklist
- [ ] All tests pass
- [ ] No code duplication
- [ ] JSDoc comments present
- [ ] Dependencies properly injected
- [ ] Error handling consistent
- [ ] Socket.IO emissions correct
- [ ] Both DB and memory modes work

---

## 12. Alternative Approaches Considered

### Alternative 1: Keep Monolithic File
**Pros**: No refactoring risk, works as-is  
**Cons**: Continued difficulty maintaining, hard to test in isolation  
**Decision**: ❌ Rejected - Technical debt too high

### Alternative 2: Microservices
**Pros**: Maximum separation, independent deployment  
**Cons**: Over-engineering, adds network latency, complex orchestration  
**Decision**: ❌ Rejected - Not appropriate scale

### Alternative 3: Class-Based Architecture
**Pros**: OOP patterns, encapsulation  
**Cons**: More complex than needed, harder testing, this is not idiomatic Node.js  
**Decision**: ❌ Rejected - Factory pattern simpler

### Alternative 4: TypeScript Conversion
**Pros**: Type safety, better IDE support  
**Cons**: Large scope change, learning curve, not requested  
**Decision**: 🟡 Deferred - Can be done after modularization

### **Alternative 5: Gradual Modular Extraction** ✅ SELECTED
**Pros**: Low risk, testable at each step, easy rollback, maintains compatibility  
**Cons**: Takes longer than rewrite  
**Decision**: ✅ **Selected** - Best balance of risk and reward

---

## 13. Post-Refactoring Opportunities

### Immediate (0-1 months)
- Add TypeScript types (`.d.ts` files)
- Improve error messages
- Add request/response schemas
- Enhance logging

### Short-term (1-3 months)
- Extract more business logic to services
- Add caching layers
- Implement request batching
- Add performance monitoring

### Long-term (3-6 months)
- Consider GraphQL for flexible queries
- Add WebSocket clustering
- Implement event sourcing for game state
- Add audit logging

---

## 14. References

### Internal Documentation
- [`AGENTS.md`](AGENTS.md:1) - Repository rules and constraints
- [`OPTIMIZATIONS.md`](OPTIMIZATIONS.md:1) - Performance findings
- [`backend/handlers/game/README.md`](backend/handlers/game/README.md:1) - Current module structure
- [`backend/utils/gameStateMachine.js`](backend/utils/gameStateMachine.js:1) - State transitions

### Related Files
- [`backend/server.js`](backend/server.js:677) - Handler initialization
- [`backend/services/gameMoveService.js`](backend/services/gameMoveService.js:1) - Move service pattern
- [`backend/handlers/gameHandlers.test.js`](backend/handlers/gameHandlers.test.js:1) - Existing tests

### External Resources
- Node.js Factory Pattern: https://nodejs.org/api/modules.html
- Dependency Injection in JavaScript: https://en.wikipedia.org/wiki/Dependency_injection
- Express.js Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html

---

## 15. Conclusion

This refactoring plan provides a comprehensive, low-risk approach to modularizing the 2287-line [`gameHandlers.js`](backend/handlers/gameHandlers.js:1) file. By following the phased approach and testing at each step, we can achieve a maintainable codebase while preserving all existing functionality.

**Key Success Factors**:
1. ✅ Incremental extraction (one handler at a time)
2. ✅ Continuous testing (after each change)
3. ✅ Clear rollback strategy (git commits)
4. ✅ Comprehensive documentation (this plan)
5. ✅ Preserved backward compatibility (no breaking changes)

**Final Structure**:
- Main file: ~200 lines (orchestration only)
- 8 handler modules: ~150-350 lines each
- 5 utility modules: ~80-280 lines each
- 3 validation modules: ~80-100 lines each
- Total improvement: More modular, testable, maintainable

The refactoring maintains all 542 existing tests while providing a foundation for future enhancements and easier onboarding of new developers.

---

**Plan Status**: ✅ Ready for Implementation  
**Risk Level**: 🟡 Medium (mitigated with phased approach)  
**Estimated Duration**: 2-4 days  
**Prerequisites**: Feature branch, test baseline, team communication  

**Next Steps**: Review plan → Get approval → Begin Phase 1
