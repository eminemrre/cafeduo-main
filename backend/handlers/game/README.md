# Game Handlers Refactoring

## Overview

The `gameHandlers.js` file (originally 2231 lines) has been refactored to improve maintainability by extracting utility functions into separate modules.

## Module Structure

```
backend/handlers/
├── gameHandlers.js          # Main route handlers (still ~2200 lines)
└── game/                    # Extracted utility modules
    ├── index.js             # Barrel export
    ├── chessUtils.js        # Chess-specific logic
    ├── emissionUtils.js     # Socket.IO emission helpers
    ├── settlementUtils.js   # Point transfers & statistics
    └── drawOfferUtils.js    # Draw offer normalization
```

## Module Descriptions

### chessUtils.js (~280 lines)
Chess-specific utilities including:
- Chess clock configuration and normalization
- Chess state management (FEN, move history)
- Participant color resolution (white/black)
- Move payload sanitization
- Timeout resolution for clock expiration

### emissionUtils.js (~40 lines)
Socket.IO emission utilities:
- `emitRealtimeUpdate(gameId, payload)` - Emit to game room
- `emitLobbyUpdate(payload)` - Emit to all clients
- Factory function `createEmissionUtils(io)` for dependency injection

### settlementUtils.js (~230 lines)
Game settlement logic:
- `applyDbSettlement()` - Database point transfers
- `applyMemorySettlement()` - In-memory point transfers
- `mapTransitionError()` - Error formatting
- Non-competitive game type detection

### drawOfferUtils.js (~60 lines)
Draw offer utilities:
- `normalizeDrawOfferAction()` - Validate offer actions
- `normalizeDrawOffer()` - Normalize offer objects
- `findOpponentName()` - Find opponent for a participant
- Factory function `createDrawOfferUtils(getGameParticipants)`

## Current Status

**Phase 1 (Completed)**: Utility modules extracted and imported into gameHandlers.js
- Original functions remain in place for backward compatibility
- Imported utilities are prefixed with `imported*` to avoid naming conflicts
- No breaking changes to existing functionality

**Phase 2 (Planned)**: Gradual migration to use imported utilities
- Replace inline function calls with imported versions
- Remove duplicate code after verification
- Update tests to use modular utilities

**Phase 3 (Planned)**: Extract route handlers into separate modules
- `createGame.js` - POST /games
- `joinGame.js` - POST /games/:id/join
- `makeMove.js` - POST /games/:id/move
- `drawOffer.js` - POST /games/:id/draw
- `resignGame.js` - POST /games/:id/resign
- `finishGame.js` - POST /games/:id/finish
- etc.

## Benefits

1. **Improved Testability**: Each utility can be tested independently
2. **Better Code Organization**: Related functions grouped by domain
3. **Easier Maintenance**: Changes to chess logic don't affect settlement logic
4. **Reduced File Size**: Main file can be reduced from 2231 to ~500 lines
5. **Reusability**: Utilities can be imported by other modules if needed

## Migration Notes

When migrating to use the imported utilities:

1. Replace function call with imported version
2. Verify tests pass
3. Remove original function definition
4. Remove `imported*` prefix (rename import)

Example:
```javascript
// Before
const chessState = createInitialChessState(req.body?.chessClock);

// After (Phase 2)
const chessState = importedCreateInitialChessState(req.body?.chessClock);

// Final (Phase 3)
const { createInitialChessState } = require('./game/chessUtils');
const chessState = createInitialChessState(req.body?.chessClock);
```
