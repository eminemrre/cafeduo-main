import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';

type Owner = 'player' | 'opponent';
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

const initState = (): MonopolyState => ({
  playerPos: 0,
  opponentPos: 0,
  playerCash: 1500,
  opponentCash: 1500,
  properties: {},
  turn: 'player',
  turnCount: 0,
  lastRoll: 0,
  message: 'Zar atarak başla.',
  pendingPurchase: null,
  finished: false,
  winner: null,
});

const rollDice = (): number => 1 + Math.floor(Math.random() * 6);
const passStartBonus = (oldPos: number, newPos: number): number => (newPos < oldPos ? 200 : 0);

const resolveWinnerByCash = (
  playerCash: number,
  opponentCash: number,
  playerName: string,
  opponentName: string
): string => {
  if (playerCash === opponentCash) return 'Berabere';
  return playerCash > opponentCash ? playerName : opponentName;
};

export const MonopolySocial: React.FC<MonopolySocialProps> = ({
  currentUser,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? 'MONOPOLY BOT' : (opponentName || 'Arkadaşın')), [isBot, opponentName]);
  const [state, setState] = useState<MonopolyState>(() => initState());
  const sentRef = useRef(false);
  const leaveHandledRef = useRef(false);

  useEffect(() => {
    setState(initState());
    sentRef.current = false;
  }, [isBot, opponentLabel]);

  const finishGame = (winner: string) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  };

  const settleLanding = (base: MonopolyState, owner: Owner, nextPos: number): MonopolyState => {
    const tile = BOARD[nextPos];
    if (!tile || tile.id === 0) {
      return {
        ...base,
        message: `${owner === 'player' ? 'Sen' : opponentLabel} başlangıçtan geçti.`,
      };
    }

    const existingOwner = base.properties[tile.id];
    if (!existingOwner) {
      const ownerCash = owner === 'player' ? base.playerCash : base.opponentCash;
      if (ownerCash >= tile.cost) {
        return {
          ...base,
          pendingPurchase: { owner, tileId: tile.id },
          message: `${tile.name} boş. ${tile.cost} CP ile satın alabilirsin.`,
        };
      }
      return {
        ...base,
        message: `${tile.name} boş ama bütçe yetersiz.`,
      };
    }

    if (existingOwner === owner) {
      return {
        ...base,
        message: `${tile.name} zaten sende.`,
      };
    }

    const payerCash = owner === 'player' ? base.playerCash : base.opponentCash;
    const payAmount = Math.min(tile.rent, Math.max(0, payerCash));
    const nextPlayerCash =
      owner === 'player'
        ? base.playerCash - payAmount
        : base.playerCash + payAmount;
    const nextOpponentCash =
      owner === 'opponent'
        ? base.opponentCash - payAmount
        : base.opponentCash + payAmount;

    return {
      ...base,
      playerCash: nextPlayerCash,
      opponentCash: nextOpponentCash,
      message: `${tile.name} kirası ödendi: ${payAmount} CP.`,
    };
  };

  const maybeEndByState = (next: MonopolyState): MonopolyState => {
    if (next.playerCash <= 0) {
      return { ...next, finished: true, winner: opponentLabel, message: 'Bütçen tükendi.' };
    }
    if (next.opponentCash <= 0) {
      return { ...next, finished: true, winner: currentUser.username, message: `${opponentLabel} bütçeyi bitirdi.` };
    }
    if (next.turnCount >= MAX_TURNS) {
      const winner = resolveWinnerByCash(next.playerCash, next.opponentCash, currentUser.username, opponentLabel);
      return { ...next, finished: true, winner, message: `Tur limiti bitti. Kazanan: ${winner}` };
    }
    return next;
  };

  const botAutoAction = (snapshot: MonopolyState): MonopolyState => {
    if (!isBot || snapshot.turn !== 'opponent' || snapshot.finished) return snapshot;

    let working = snapshot;
    if (working.pendingPurchase && working.pendingPurchase.owner === 'opponent') {
      const tile = BOARD[working.pendingPurchase.tileId];
      if (tile && working.opponentCash > tile.cost + 180) {
        working = {
          ...working,
          opponentCash: working.opponentCash - tile.cost,
          properties: { ...working.properties, [tile.id]: 'opponent' },
          pendingPurchase: null,
          message: `${opponentLabel} ${tile.name} satın aldı.`,
        };
      } else {
        working = {
          ...working,
          pendingPurchase: null,
          message: `${opponentLabel} ${tile.name} almadı.`,
        };
      }
      working = {
        ...working,
        turn: 'player',
      };
      return maybeEndByState(working);
    }

    const dice = rollDice();
    const rawPos = (working.opponentPos + dice) % BOARD.length;
    const bonus = passStartBonus(working.opponentPos, rawPos);
    const moved = {
      ...working,
      opponentPos: rawPos,
      opponentCash: working.opponentCash + bonus,
      lastRoll: dice,
      turnCount: working.turnCount + 1,
      pendingPurchase: null,
    };
    const settled = settleLanding(moved, 'opponent', rawPos);
    if (settled.pendingPurchase?.owner === 'opponent') {
      return botAutoAction(settled);
    }
    return maybeEndByState({ ...settled, turn: 'player' });
  };

  const takeTurn = (owner: TurnOwner) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== owner || prev.pendingPurchase) return prev;

      const dice = rollDice();
      const startPos = owner === 'player' ? prev.playerPos : prev.opponentPos;
      const nextPos = (startPos + dice) % BOARD.length;
      const bonus = passStartBonus(startPos, nextPos);

      const moved: MonopolyState = owner === 'player'
        ? {
            ...prev,
            playerPos: nextPos,
            playerCash: prev.playerCash + bonus,
            lastRoll: dice,
            turnCount: prev.turnCount + 1,
            pendingPurchase: null,
          }
        : {
            ...prev,
            opponentPos: nextPos,
            opponentCash: prev.opponentCash + bonus,
            lastRoll: dice,
            turnCount: prev.turnCount + 1,
            pendingPurchase: null,
          };

      const settled = settleLanding(moved, owner, nextPos);
      if (settled.pendingPurchase?.owner === owner) {
        return settled;
      }

      const switched = {
        ...settled,
        turn: owner === 'player' ? 'opponent' : 'player',
      };
      return botAutoAction(maybeEndByState(switched));
    });
  };

  const resolvePurchase = (accept: boolean) => {
    setState((prev) => {
      if (!prev.pendingPurchase || prev.finished) return prev;
      const { owner, tileId } = prev.pendingPurchase;
      const tile = BOARD[tileId];
      if (!tile) return { ...prev, pendingPurchase: null };

      let next = { ...prev, pendingPurchase: null };
      if (accept) {
        if (owner === 'player' && prev.playerCash >= tile.cost) {
          next = {
            ...next,
            playerCash: prev.playerCash - tile.cost,
            properties: { ...prev.properties, [tile.id]: 'player' },
            message: `${tile.name} satın alındı.`,
          };
        } else if (owner === 'opponent' && prev.opponentCash >= tile.cost) {
          next = {
            ...next,
            opponentCash: prev.opponentCash - tile.cost,
            properties: { ...prev.properties, [tile.id]: 'opponent' },
            message: `${opponentLabel} ${tile.name} satın aldı.`,
          };
        }
      } else {
        next = {
          ...next,
          message: `${tile.name} pas geçildi.`,
        };
      }

      next = {
        ...next,
        turn: owner === 'player' ? 'opponent' : 'player',
      };

      return botAutoAction(maybeEndByState(next));
    });
  };

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner]);

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
          <p className="font-semibold text-cyan-200 mt-1">{state.turn === 'player' ? 'Sende' : opponentLabel}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Sen</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.playerCash} CP</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{opponentLabel}</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.opponentCash} CP</p>
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
            const playerHere = state.playerPos === cell.id;
            const opponentHere = state.opponentPos === cell.id;
            return (
              <div
                key={cell.id}
                className={`w-28 h-24 border p-2 text-xs ${owner === 'player'
                    ? 'border-cyan-300 bg-cyan-500/12'
                    : owner === 'opponent'
                      ? 'border-fuchsia-300 bg-fuchsia-500/12'
                      : 'border-cyan-500/30 bg-black/25'
                  }`}
              >
                <p className="font-semibold truncate">{cell.name}</p>
                {cell.id !== 0 && (
                  <p className="text-[10px] text-[var(--rf-muted)] mt-1">Maliyet {cell.cost} / Kira {cell.rent}</p>
                )}
                <div className="mt-2 flex gap-1">
                  {playerHere && <span className="px-1 bg-cyan-400 text-[#021025] font-bold">S</span>}
                  {opponentHere && <span className="px-1 bg-fuchsia-400 text-[#021025] font-bold">R</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!state.finished && state.pendingPurchase && (
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

      {!state.finished && !state.pendingPurchase && (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <RetroButton onClick={() => takeTurn('player')} disabled={state.turn !== 'player'}>
            Zar At
          </RetroButton>
          {!isBot && (
            <RetroButton variant="secondary" onClick={() => takeTurn('opponent')} disabled={state.turn !== 'opponent'}>
              Rakip Zar Atsın
            </RetroButton>
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
