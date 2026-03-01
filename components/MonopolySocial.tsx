import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { socketService } from '../lib/socket';

type Owner = 'host' | 'guest';
type TurnOwner = Owner;

interface MonopolySocialProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface BoardCell {
  id: number;
  name: string;
  cost: number;
  rent: number;
}

interface PendingPurchase {
  owner: Owner;
  tileId: number;
}

interface MonopolyState {
  hostPos: number;
  guestPos: number;
  hostCash: number;
  guestCash: number;
  properties: Record<number, Owner>;
  turn: TurnOwner;
  turnCount: number;
  lastRoll: number;
  message: string;
  pendingPurchase: PendingPurchase | null;
  finished: boolean;
  winner: string | null;
  hostName: string;
  guestName: string;
}

const BOARD: BoardCell[] = Array.from({ length: 20 }).map((_, index) => {
  if (index === 0) {
    return { id: 0, name: 'BAŞLANGIÇ', cost: 0, rent: 0 };
  }
  const cost = 120 + index * 22;
  return {
    id: index,
    name: `Sokak ${index}`,
    cost,
    rent: Math.floor(cost * 0.22),
  };
});

const MAX_TURNS = 30;

const initState = (hostName: string, guestName: string): MonopolyState => ({
  hostPos: 0,
  guestPos: 0,
  hostCash: 1500,
  guestCash: 1500,
  properties: {},
  turn: 'host',
  turnCount: 0,
  lastRoll: 0,
  message: 'Zar atarak başla.',
  pendingPurchase: null,
  finished: false,
  winner: null,
  hostName,
  guestName,
});

const rollDice = (): number => 1 + Math.floor(Math.random() * 6);
const passStartBonus = (oldPos: number, newPos: number): number => (newPos < oldPos ? 200 : 0);

const resolveWinnerByCash = (
  hostCash: number,
  guestCash: number,
  hostName: string,
  guestName: string
): string => {
  if (hostCash === guestCash) return 'Berabere';
  return hostCash > guestCash ? hostName : guestName;
};

export const MonopolySocial: React.FC<MonopolySocialProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? 'MONOPOLY BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);
  
  // Determine if current user is host or guest
  // Host is always the game creator; in bot mode, player is always host
  const [myRole, setMyRole] = useState<Owner>('host');
  const [state, setState] = useState<MonopolyState>(() => initState(currentUser.username, opponentLabel));
  const sentRef = useRef(false);
  const socketRef = useRef(socketService.getSocket());
  const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot);
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceValue, setDiceValue] = useState<number | null>(null);

  const isMyTurn = useMemo(() => state.turn === myRole, [state.turn, myRole]);
  const myName = currentUser.username;
  const myPos = myRole === 'host' ? state.hostPos : state.guestPos;
  const myCash = myRole === 'host' ? state.hostCash : state.guestCash;
  const opponentPos = myRole === 'host' ? state.guestPos : state.hostPos;
  const opponentCash = myRole === 'host' ? state.guestCash : state.hostCash;

  // ======= Socket.IO Setup =======
  useEffect(() => {
    if (isBot || !gameId) return;

    const socket = socketService.getSocket();
    socketRef.current = socket;

    // Join game room
    socketService.joinGame(String(gameId));

    // Listen for opponent moves
    const handleOpponentMove = (data: any) => {
      if (!data?.move) return;
      const move = data.move;

      if (move.type === 'full_state') {
        // Receive full state from host (initial sync or state recovery)
        setState(move.state);
        setWaitingForOpponent(false);
      } else if (move.type === 'roll') {
        // Opponent rolled dice - apply their move
        setState((prev) => {
          if (prev.finished) return prev;
          const rollerRole = move.roller as Owner;
          const dice = move.dice as number;
          const startPos = rollerRole === 'host' ? prev.hostPos : prev.guestPos;
          const nextPos = (startPos + dice) % BOARD.length;
          const bonus = passStartBonus(startPos, nextPos);

          const moved: MonopolyState = rollerRole === 'host'
            ? { ...prev, hostPos: nextPos, hostCash: prev.hostCash + bonus, lastRoll: dice, turnCount: prev.turnCount + 1, pendingPurchase: null }
            : { ...prev, guestPos: nextPos, guestCash: prev.guestCash + bonus, lastRoll: dice, turnCount: prev.turnCount + 1, pendingPurchase: null };

          return settleLandingPure(moved, rollerRole, nextPos);
        });
      } else if (move.type === 'purchase') {
        // Opponent made purchase decision
        setState((prev) => {
          if (!prev.pendingPurchase || prev.finished) return prev;
          const { owner, tileId } = prev.pendingPurchase;
          const tile = BOARD[tileId];
          if (!tile) return { ...prev, pendingPurchase: null };

          let next = { ...prev, pendingPurchase: null };
          if (move.accepted) {
            if (owner === 'host' && prev.hostCash >= tile.cost) {
              next = { ...next, hostCash: prev.hostCash - tile.cost, properties: { ...prev.properties, [tile.id]: 'host' }, message: `${tile.name} satın alındı.` };
            } else if (owner === 'guest' && prev.guestCash >= tile.cost) {
              next = { ...next, guestCash: prev.guestCash - tile.cost, properties: { ...prev.properties, [tile.id]: 'guest' }, message: `${prev.guestName} ${tile.name} satın aldı.` };
            }
          } else {
            next = { ...next, message: `${tile.name} pas geçildi.` };
          }

          next = { ...next, turn: owner === 'host' ? 'guest' : 'host' };
          return maybeEndByStatePure(next);
        });
      } else if (move.type === 'game_end') {
        setState((prev) => ({
          ...prev,
          finished: true,
          winner: move.winner,
          message: move.message || 'Oyun bitti.',
        }));
      }
    };

    // Listen for game state updates (reconnection recovery)
    const handleStateUpdated = (stateData: any) => {
      if (stateData && typeof stateData === 'object' && 'hostPos' in stateData) {
        setState(stateData as MonopolyState);
        setWaitingForOpponent(false);
      }
    };

    socket?.on('opponent_move', handleOpponentMove);
    socket?.on('game_state_updated', handleStateUpdated);

    return () => {
      socket?.off('opponent_move', handleOpponentMove);
      socket?.off('game_state_updated', handleStateUpdated);
    };
  }, [gameId, isBot]);

  // Determine role when game starts
  useEffect(() => {
    if (isBot) {
      setMyRole('host');
      setWaitingForOpponent(false);
      return;
    }

    // In PvP, determine role based on whether username matches hostName or opponentName
    // The creator (host) is always the current user's position
    // If opponentName exists and matches currentUser, we're guest
    if (opponentName && opponentName.toLowerCase() !== currentUser.username.toLowerCase()) {
      // We created the game, we're host
      setMyRole('host');
    } else if (opponentName && opponentName.toLowerCase() === currentUser.username.toLowerCase()) {
      // We joined someone else's game, we might be guest
      setMyRole('guest');
    } else {
      setMyRole('host');
    }
  }, [isBot, opponentName, currentUser.username]);

  // Initialize state with correct names
  useEffect(() => {
    const hostN = myRole === 'host' ? currentUser.username : opponentLabel;
    const guestN = myRole === 'host' ? opponentLabel : currentUser.username;
    setState(initState(hostN, guestN));
    sentRef.current = false;
    setWaitingForOpponent(!isBot);

    // If we're host in PvP, send initial state to guest
    if (!isBot && myRole === 'host' && gameId) {
      const initialState = initState(hostN, guestN);
      setTimeout(() => {
        socketService.emitMove(String(gameId), {
          type: 'full_state',
          state: initialState,
        });
        setWaitingForOpponent(false);
      }, 1000);
    }
  }, [isBot, opponentLabel, myRole, currentUser.username]);

  // ======= Game Logic (pure functions) =======
  const settleLandingPure = useCallback((base: MonopolyState, owner: Owner, nextPos: number): MonopolyState => {
    const tile = BOARD[nextPos];
    if (!tile || tile.id === 0) {
      return { ...base, message: `${owner === 'host' ? base.hostName : base.guestName} başlangıçtan geçti.` };
    }

    const existingOwner = base.properties[tile.id];
    if (!existingOwner) {
      const ownerCash = owner === 'host' ? base.hostCash : base.guestCash;
      if (ownerCash >= tile.cost) {
        return {
          ...base,
          pendingPurchase: { owner, tileId: tile.id },
          message: `${tile.name} boş. ${tile.cost} CP ile satın alabilirsin.`,
        };
      }
      return { ...base, message: `${tile.name} boş ama bütçe yetersiz.` };
    }

    if (existingOwner === owner) {
      return { ...base, message: `${tile.name} zaten sende.` };
    }

    const payerCash = owner === 'host' ? base.hostCash : base.guestCash;
    const payAmount = Math.min(tile.rent, Math.max(0, payerCash));
    const nextHostCash = owner === 'host' ? base.hostCash - payAmount : base.hostCash + payAmount;
    const nextGuestCash = owner === 'guest' ? base.guestCash - payAmount : base.guestCash + payAmount;

    return {
      ...base,
      hostCash: nextHostCash,
      guestCash: nextGuestCash,
      message: `${tile.name} kirası ödendi: ${payAmount} CP.`,
    };
  }, []);

  const maybeEndByStatePure = useCallback((next: MonopolyState): MonopolyState => {
    if (next.hostCash <= 0) {
      return { ...next, finished: true, winner: next.guestName, message: `${next.hostName} bütçeyi bitirdi.` };
    }
    if (next.guestCash <= 0) {
      return { ...next, finished: true, winner: next.hostName, message: `${next.guestName} bütçeyi bitirdi.` };
    }
    if (next.turnCount >= MAX_TURNS) {
      const winner = resolveWinnerByCash(next.hostCash, next.guestCash, next.hostName, next.guestName);
      return { ...next, finished: true, winner, message: `Tur limiti bitti. Kazanan: ${winner}` };
    }
    return next;
  }, []);

  // ======= Bot Logic =======
  const botAutoAction = useCallback((snapshot: MonopolyState): MonopolyState => {
    if (!isBot || snapshot.turn !== 'guest' || snapshot.finished) return snapshot;

    let working = snapshot;
    if (working.pendingPurchase && working.pendingPurchase.owner === 'guest') {
      const tile = BOARD[working.pendingPurchase.tileId];
      if (tile && working.guestCash > tile.cost + 180) {
        working = {
          ...working,
          guestCash: working.guestCash - tile.cost,
          properties: { ...working.properties, [tile.id]: 'guest' },
          pendingPurchase: null,
          message: `${opponentLabel} ${tile.name} satın aldı.`,
        };
      } else {
        working = { ...working, pendingPurchase: null, message: `${opponentLabel} ${tile.name} almadı.` };
      }
      working = { ...working, turn: 'host' as TurnOwner };
      return maybeEndByStatePure(working);
    }

    const dice = rollDice();
    const rawPos = (working.guestPos + dice) % BOARD.length;
    const bonus = passStartBonus(working.guestPos, rawPos);
    const moved = {
      ...working,
      guestPos: rawPos,
      guestCash: working.guestCash + bonus,
      lastRoll: dice,
      turnCount: working.turnCount + 1,
      pendingPurchase: null,
    };
    const settled = settleLandingPure(moved, 'guest', rawPos);
    if (settled.pendingPurchase?.owner === 'guest') {
      return botAutoAction(settled);
    }
    return maybeEndByStatePure({ ...settled, turn: 'host' as TurnOwner });
  }, [isBot, opponentLabel, settleLandingPure, maybeEndByStatePure]);

  // ======= Player Actions =======
  const takeTurn = () => {
    if (diceRolling) return; // Prevent multiple clicks during animation
    
    setDiceRolling(true);
    const dice = rollDice();
    setDiceValue(dice);
    
    // Animate dice roll
    setTimeout(() => {
      setDiceRolling(false);
      
      setState((prev) => {
        if (prev.finished || prev.turn !== myRole || prev.pendingPurchase) return prev;

        const startPos = myRole === 'host' ? prev.hostPos : prev.guestPos;
        const nextPos = (startPos + dice) % BOARD.length;
        const bonus = passStartBonus(startPos, nextPos);

        const moved: MonopolyState = myRole === 'host'
          ? { ...prev, hostPos: nextPos, hostCash: prev.hostCash + bonus, lastRoll: dice, turnCount: prev.turnCount + 1, pendingPurchase: null }
          : { ...prev, guestPos: nextPos, guestCash: prev.guestCash + bonus, lastRoll: dice, turnCount: prev.turnCount + 1, pendingPurchase: null };

        const settled = settleLandingPure(moved, myRole, nextPos);

        // If there's a pending purchase for us, don't switch turn yet
        if (settled.pendingPurchase?.owner === myRole) {
          // Emit move to opponent (PvP)
          if (!isBot && gameId) {
            socketService.emitMove(String(gameId), { type: 'roll', roller: myRole, dice });
          }
          return settled;
        }

        const nextTurn: TurnOwner = myRole === 'host' ? 'guest' : 'host';
        const switched = { ...settled, turn: nextTurn };
        const checked = maybeEndByStatePure(switched);

        // Emit move to opponent (PvP)
        if (!isBot && gameId) {
          socketService.emitMove(String(gameId), { type: 'roll', roller: myRole, dice });
        }

        // Bot auto-play after our turn
        return botAutoAction(checked);
      });
    }, 600); // Wait for dice animation
  };

  const resolvePurchase = (accept: boolean) => {
    setState((prev) => {
      if (!prev.pendingPurchase || prev.finished) return prev;
      const { owner, tileId } = prev.pendingPurchase;
      const tile = BOARD[tileId];
      if (!tile) return { ...prev, pendingPurchase: null };

      // Only the owner of the pending purchase can decide
      if (owner !== myRole && !isBot) return prev;

      let next = { ...prev, pendingPurchase: null };
      if (accept) {
        if (owner === 'host' && prev.hostCash >= tile.cost) {
          next = { ...next, hostCash: prev.hostCash - tile.cost, properties: { ...prev.properties, [tile.id]: 'host' }, message: `${tile.name} satın alındı.` };
        } else if (owner === 'guest' && prev.guestCash >= tile.cost) {
          next = { ...next, guestCash: prev.guestCash - tile.cost, properties: { ...prev.properties, [tile.id]: 'guest' }, message: `${opponentLabel} ${tile.name} satın aldı.` };
        }
      } else {
        next = { ...next, message: `${tile.name} pas geçildi.` };
      }

      next = { ...next, turn: (owner === 'host' ? 'guest' : 'host') as TurnOwner };
      const checked = maybeEndByStatePure(next);

      // Emit purchase decision to opponent (PvP)
      if (!isBot && gameId) {
        socketService.emitMove(String(gameId), { type: 'purchase', accepted: accept, tileId, owner });
      }

      return botAutoAction(checked);
    });
  };

  // ======= Game End Handler =======
  const finishGame = useCallback((winner: string) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  }, [onGameEnd]);

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner, finishGame]);

  // ======= Render =======
  if (waitingForOpponent && !isBot) {
    return (
      <div className="max-w-6xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
        <div className="rf-terminal-strip mb-2">Sosyal Masa // Monopoly Mini</div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">Monopoly Sosyal</h2>
          <button type="button" onClick={onLeave} className="px-3 py-2 border border-rose-400/45 bg-rose-500/12 text-rose-200 hover:bg-rose-500/24 transition-colors text-xs uppercase tracking-[0.12em]">
            Oyundan Çık
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-cyan-200 text-lg">Rakip bekleniyor...</p>
          <p className="text-sm text-[var(--rf-muted)]">Oyun başladığında otomatik olarak başlayacak.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
      <div className="rf-terminal-strip mb-2">Sosyal Masa // Monopoly Mini</div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">Monopoly Sosyal</h2>
        <button
          type="button"
          onClick={onLeave}
          className="px-3 py-2 border border-rose-400/45 bg-rose-500/12 text-rose-200 hover:bg-rose-500/24 transition-colors text-xs uppercase tracking-[0.12em]"
        >
          Oyundan Çık
        </button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Sıra</p>
          <p className={`font-semibold mt-1 ${isMyTurn ? 'text-emerald-300' : 'text-rose-300'}`}>
            {isMyTurn ? '🎲 Sende' : `⏳ ${opponentLabel}`}
          </p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{myName}</p>
          <p className="font-semibold text-cyan-200 mt-1">{myCash} CP</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{opponentLabel}</p>
          <p className="font-semibold text-cyan-200 mt-1">{opponentCash} CP</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Tur / Zar</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.turnCount}/{MAX_TURNS} | {state.lastRoll || '-'}</p>
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-4 pl-3 border-l-2 border-cyan-400/60">{state.message}</p>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {BOARD.map((cell) => {
            const owner = state.properties[cell.id];
            const myPosHere = (myRole === 'host' ? state.hostPos : state.guestPos) === cell.id;
            const oppPosHere = (myRole === 'host' ? state.guestPos : state.hostPos) === cell.id;
            return (
              <div
                key={cell.id}
                className={`relative w-28 h-24 border p-2 text-xs transition-all hover:scale-105 hover:shadow-lg ${
                  owner === myRole
                    ? 'border-cyan-300 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10'
                    : owner
                      ? 'border-fuchsia-300 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10'
                      : 'border-cyan-500/30 bg-gradient-to-br from-black/30 to-black/20 hover:border-cyan-500/50'
                }`}
              >
                {/* Pattern overlay for unowned cells */}
                {!owner && cell.id !== 0 && (
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,rgba(34,211,238,0.1)_25%,transparent_25%,transparent_50%,rgba(34,211,238,0.1)_50%,rgba(34,211,238,0.1)_75%,transparent_75%,transparent_100%)] [background-size:8px_8px] pointer-events-none" />
                )}
                
                {/* Ownership badge */}
                {owner && (
                  <div className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-sm animate-ownership-badge ${
                    owner === myRole
                      ? 'bg-cyan-400 text-[#021025] border border-cyan-300'
                      : 'bg-fuchsia-400 text-[#021025] border border-fuchsia-300'
                  }`}>
                    {owner === myRole ? 'SENİN' : 'RAKİP'}
                  </div>
                )}
                
                <p className="font-semibold truncate relative z-10">{cell.name}</p>
                {cell.id !== 0 && (
                  <p className="text-[10px] text-[var(--rf-muted)] mt-1 relative z-10">Maliyet {cell.cost} / Kira {cell.rent}</p>
                )}
                <div className="mt-2 flex gap-1 relative z-10">
                  {myPosHere && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 text-[#021025] font-bold flex items-center justify-center text-xs shadow-lg animate-avatar-pop border border-cyan-300">
                      S
                    </div>
                  )}
                  {oppPosHere && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-400 to-fuchsia-500 text-[#021025] font-bold flex items-center justify-center text-xs shadow-lg animate-avatar-pop border border-fuchsia-300">
                      R
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!state.finished && state.pendingPurchase && state.pendingPurchase.owner === myRole && (
        <div className="mt-4 rf-screen-card-muted p-3">
          <p className="text-sm mb-3">
            {BOARD[state.pendingPurchase.tileId]?.name} satın alınsın mı? ({BOARD[state.pendingPurchase.tileId]?.cost} CP)
          </p>
          <div className="flex gap-3">
            <RetroButton onClick={() => resolvePurchase(true)}>Satın Al</RetroButton>
            <RetroButton variant="secondary" onClick={() => resolvePurchase(false)}>Pas Geç</RetroButton>
          </div>
        </div>
      )}

      {!state.finished && state.pendingPurchase && state.pendingPurchase.owner !== myRole && !isBot && (
        <div className="mt-4 rf-screen-card-muted p-3">
          <p className="text-sm text-[var(--rf-muted)]">
            {opponentLabel} satın alma kararı veriyor...
          </p>
        </div>
      )}

      {!state.finished && !state.pendingPurchase && (
        <div className="mt-4 flex items-center gap-4">
          <RetroButton onClick={takeTurn} disabled={!isMyTurn || diceRolling}>
            {diceRolling ? 'Zar Atılıyor...' : (isMyTurn ? '🎲 Zar At' : `⏳ ${opponentLabel} oynuyor...`)}
          </RetroButton>
          
          {/* Dice animation display */}
          {diceRolling && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-cyan-600/30 border-2 border-cyan-400 flex items-center justify-center text-2xl font-bold animate-dice-spin">
                🎲
              </div>
              <span className="text-sm text-cyan-300 animate-pulse">Atılıyor...</span>
            </div>
          )}
          
          {/* Last dice result (when not rolling) */}
          {!diceRolling && diceValue && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border-2 border-emerald-400 flex items-center justify-center text-xl font-bold">
                {diceValue}
              </div>
              <span className="text-xs text-[var(--rf-muted)]">Son Zar</span>
            </div>
          )}
        </div>
      )}

      {state.finished && (
        <div className="mt-5">
          <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
        </div>
      )}
    </div>
  );
};

export default MonopolySocial;
