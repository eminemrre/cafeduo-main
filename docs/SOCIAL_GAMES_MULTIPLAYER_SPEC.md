# Social Games Multiplayer Implementation Spec

## Current Status

The social games (Monopoly, UNO, Okey101) currently work as **local hotseat games**:
- ✅ Bot mode: Works perfectly
- ❌ PvP mode: Only works on same device (players take turns on same screen)
- ❌ Real-time multiplayer: Not implemented

## Goal

Convert social games to use Socket.IO for true multiplayer experience where two players on different devices can play together in real-time.

## Architecture

### Current Implementation
```
Player 1 Device          Player 2 Device
     |                         |
     └─────── Same Device ─────┘
          (Hotseat Mode)
```

### Target Implementation
```
Player 1 Device          Socket.IO Server          Player 2 Device
     |                         |                         |
     ├──── join_game ─────────>│                         │
     │                          │<───── join_game ────────┤
     │                          │                         │
     ├──── game_move ──────────>│                         │
     │                          ├──── opponent_move ─────>│
     │                          │                         │
     │<──── opponent_move ──────┤<──── game_move ─────────┤
```

## Implementation Steps

### 1. MonopolySocial (Priority: HIGH)

**Current State Structure:**
```typescript
interface MonopolyState {
  playerPos: number;
  opponentPos: number;
  playerCash: number;
  opponentCash: number;
  properties: Record<number, Owner>;
  turn: TurnOwner;
  turnCount: number;
  lastRoll: number;
  message: string;
  pendingPurchase: PendingPurchase | null;
  finished: boolean;
  winner: string | null;
}
```

**Required Changes:**

#### Frontend (`components/MonopolySocial.tsx`)
1. **Add Socket.IO hooks:**
   ```typescript
   const socket = socketService.getSocket();
   const [isConnected, setIsConnected] = useState(false);
   const [isMyTurn, setIsMyTurn] = useState(false);
   ```

2. **Join game room on mount:**
   ```typescript
   useEffect(() => {
     if (gameId) {
       socketService.joinGame(String(gameId));
     }
   }, [gameId]);
   ```

3. **Listen for opponent moves:**
   ```typescript
   useEffect(() => {
     const handleOpponentMove = (data: any) => {
       if (data.move.type === 'roll') {
         // Apply opponent's dice roll
       } else if (data.move.type === 'purchase') {
         // Apply opponent's purchase decision
       }
     };
     
     socket?.on('opponent_move', handleOpponentMove);
     return () => { socket?.off('opponent_move', handleOpponentMove); };
   }, [socket]);
   ```

4. **Emit moves when player acts:**
   ```typescript
   const takeTurn = (owner: TurnOwner) => {
     // ... existing logic ...
     
     if (owner === 'player' && !isBot) {
       socketService.emitMove(String(gameId), {
         type: 'roll',
         dice: diceValue,
         position: nextPos
       });
     }
   };
   ```

5. **Remove hotseat UI:**
   - Remove "Rakip Zar Atsın" button
   - Add turn indicator showing whose turn it is
   - Disable actions when not player's turn

#### Backend (`backend/server.js`)
1. **Add game state validation:**
   ```javascript
   socket.on('monopoly_move', async (data) => {
     const { gameId, move } = data;
     
     // Validate it's player's turn
     const game = await db.query('SELECT gameState FROM games WHERE id = $1', [gameId]);
     const state = game.rows[0]?.gameState;
     
     if (state.currentPlayer !== socket.username) {
       return socket.emit('error', { message: 'Not your turn' });
     }
     
     // Broadcast to opponent
     socket.to(gameId).emit('opponent_move', {
       player: socket.username,
       move
     });
     
     // Update game state in DB
     await db.query('UPDATE games SET gameState = $1 WHERE id = $2', [
       JSON.stringify(newState),
       gameId
     ]);
   });
   ```

### 2. UnoSocial (Priority: MEDIUM)

**Current State Structure:**
```typescript
interface UnoState {
  deck: UnoCard[];
  discard: UnoCard[];
  playerHand: UnoCard[];
  opponentHand: UnoCard[];
  turn: TurnOwner;
  message: string;
  finished: boolean;
  winner: string | null;
}
```

**Key Challenges:**
- Hand privacy: Opponent shouldn't see player's cards
- Card drawing must be synchronized
- Deck state must be server-authoritative

**Required Changes:**
1. Hide opponent hand (show card count only)
2. Server manages deck and deals cards
3. Client only shows own hand
4. Emit `play_card` and `draw_card` events
5. Receive `opponent_played_card` and `opponent_drew_card` events

### 3. Okey101Social (Priority: MEDIUM)

Similar to UNO but with more complex meld scoring logic.

**Key Challenges:**
- Tile privacy
- Discard pile management
- Win condition validation on server

## Testing Strategy

### Unit Tests
- [ ] Socket connection and disconnection
- [ ] Move validation logic
- [ ] State synchronization
- [ ] Turn management

### Integration Tests
- [ ] Two clients can join same game
- [ ] Moves are broadcast correctly
- [ ] Game state stays synchronized
- [ ] Winner determination works
- [ ] Reconnection recovers state

### E2E Tests
- [ ] Full game playthrough with 2 real clients
- [ ] Network interruption recovery
- [ ] Concurrent move handling
- [ ] Edge cases (both players disconnect, etc.)

## Estimated Effort

| Task | Hours | Complexity |
|------|-------|------------|
| MonopolySocial refactor | 8-10 | High |
| UnoSocial refactor | 6-8 | High |
| Okey101Social refactor | 6-8 | High |
| Backend validation | 4-6 | Medium |
| Testing | 6-8 | High |
| **TOTAL** | **30-40 hours** | **Very High** |

## Alternative: Hybrid Approach

Keep current hotseat mode for bot games, add Socket.IO only for PvP:

```typescript
const isRealMultiplayer = !isBot && gameId;

if (isRealMultiplayer) {
  // Use Socket.IO
} else {
  // Use local hotseat mode
}
```

This allows:
- ✅ Bot mode continues working (no Socket.IO needed)
- ✅ Gradual rollout (implement one game at a time)
- ✅ Fallback if Socket.IO fails

## Priority Recommendation

1. **SHORT TERM**: Document current limitation in UI
   - Add tooltip: "PvP mode: Players share same device"
   - Make it clear this is hotseat mode
   
2. **MEDIUM TERM**: Implement MonopolySocial multiplayer
   - Most requested feature
   - Test bed for UNO and Okey101
   
3. **LONG TERM**: Convert all social games to Socket.IO

## Current Workaround

The games currently work correctly for:
- ✅ **Bot mode**: Player vs AI (fully functional)
- ✅ **Hotseat PvP**: Two players on same device taking turns

For real multiplayer PvP, users must:
1. Use bot mode, OR
2. Play hotseat style (share device)

## Related Files

- `components/MonopolySocial.tsx` - Monopoly game logic
- `components/UnoSocial.tsx` - UNO game logic
- `components/Okey101Social.tsx` - Okey101 game logic
- `lib/socket.ts` - Socket.IO client service
- `backend/server.js` - Socket.IO server setup (lines 256-305)
- `components/TankBattle.tsx` - Reference implementation using Socket.IO

## Notes

- TankBattle is a good reference - it uses Socket.IO correctly
- Backend already has `game_move` and `update_game_state` events
- Need to add game-specific validation logic
- Consider using `submitScoreAndWaitForWinner` pattern for game completion
