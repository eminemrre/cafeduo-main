import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';

type TileColor = 'kirmizi' | 'mavi' | 'sari' | 'siyah';
type TurnOwner = 'player' | 'opponent';

interface OkeyTile {
  id: string;
  color: TileColor;
  value: number;
}

interface Okey101SocialProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface OkeyState {
  deck: OkeyTile[];
  discardPile: OkeyTile[];
  playerHand: OkeyTile[];
  opponentHand: OkeyTile[];
  turn: TurnOwner;
  mustDraw: boolean;
  finished: boolean;
  winner: string | null;
  message: string;
}

const TILE_COLORS: TileColor[] = ['kirmizi', 'mavi', 'sari', 'siyah'];
const TILE_STYLE: Record<TileColor, string> = {
  kirmizi: 'border-rose-300/90 bg-rose-600/35',
  mavi: 'border-cyan-300/90 bg-cyan-600/35',
  sari: 'border-amber-200/90 bg-amber-500/40 text-[#071021]',
  siyah: 'border-slate-300/90 bg-slate-800/80',
};

const shuffle = <T,>(input: T[]): T[] => {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const createTileDeck = (): OkeyTile[] => {
  const deck: OkeyTile[] = [];
  for (let setIndex = 0; setIndex < 2; setIndex += 1) {
    for (const color of TILE_COLORS) {
      for (let value = 1; value <= 13; value += 1) {
        deck.push({
          id: `${setIndex}-${color}-${value}-${Math.random().toString(36).slice(2, 7)}`,
          color,
          value,
        });
      }
    }
  }
  return shuffle(deck);
};

const countColorRuns = (tiles: OkeyTile[]): number => {
  let runs = 0;
  for (const color of TILE_COLORS) {
    const values = tiles
      .filter((tile) => tile.color === color)
      .map((tile) => tile.value)
      .sort((a, b) => a - b);
    let streak = 1;
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] === values[i - 1] + 1) {
        streak += 1;
      } else if (values[i] !== values[i - 1]) {
        if (streak >= 3) runs += 1;
        streak = 1;
      }
    }
    if (streak >= 3) runs += 1;
  }
  return runs;
};

const countSameValueSets = (tiles: OkeyTile[]): number => {
  const byValue = new Map<number, Set<TileColor>>();
  for (const tile of tiles) {
    if (!byValue.has(tile.value)) byValue.set(tile.value, new Set());
    byValue.get(tile.value)?.add(tile.color);
  }
  let sets = 0;
  for (const colors of byValue.values()) {
    if (colors.size >= 3) sets += 1;
  }
  return sets;
};

const calcMeldScore = (tiles: OkeyTile[]): number => countColorRuns(tiles) + countSameValueSets(tiles);
const hasWinningShape = (tiles: OkeyTile[]): boolean => calcMeldScore(tiles) >= 3;

const initState = (): OkeyState => {
  const deck = createTileDeck();
  const playerHand = deck.slice(0, 14);
  const opponentHand = deck.slice(14, 28);
  const discard = deck[28];
  return {
    deck: deck.slice(29),
    discardPile: [discard],
    playerHand,
    opponentHand,
    turn: 'player',
    mustDraw: true,
    finished: false,
    winner: null,
    message: 'Taş çek ve bir taş at.',
  };
};

const drawFromDeck = (state: OkeyState): { nextState: OkeyState; tile: OkeyTile | null } => {
  if (!state.deck.length) return { nextState: state, tile: null };
  const nextTile = state.deck[0];
  return {
    tile: nextTile,
    nextState: {
      ...state,
      deck: state.deck.slice(1),
    },
  };
};

export const Okey101Social: React.FC<Okey101SocialProps> = ({
  currentUser,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? '101 BOT' : (opponentName || 'Arkadaşın')), [isBot, opponentName]);
  const [state, setState] = useState<OkeyState>(() => initState());
  const sentRef = useRef(false);

  useEffect(() => {
    setState(initState());
    sentRef.current = false;
  }, [isBot, opponentLabel]);

  const finishGame = (winner: string) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  };

  const playBotTurn = (source: OkeyState): OkeyState => {
    if (!isBot || source.turn !== 'opponent' || source.finished) return source;
    let working = source;

    if (working.mustDraw) {
      const { nextState, tile } = drawFromDeck(working);
      if (!tile) {
        return {
          ...working,
          turn: 'player',
          mustDraw: true,
          message: 'Deste bitti, sıra sende.',
        };
      }
      working = {
        ...nextState,
        opponentHand: [...working.opponentHand, tile],
        mustDraw: false,
        message: `${opponentLabel} taş çekti.`,
      };
    }

    const discardIndex = Math.floor(Math.random() * working.opponentHand.length);
    const discardTile = working.opponentHand[discardIndex];
    const nextHand = working.opponentHand.filter((_, i) => i !== discardIndex);
    const won = hasWinningShape(nextHand);
    return {
      ...working,
      opponentHand: nextHand,
      discardPile: [...working.discardPile, discardTile],
      turn: won ? 'opponent' : 'player',
      mustDraw: true,
      finished: won,
      winner: won ? opponentLabel : null,
      message: won
        ? `${opponentLabel} eli tamamladı.`
        : `${opponentLabel} ${discardTile.value} attı. Sıra sende.`,
    };
  };

  const drawTile = (owner: TurnOwner) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== owner || !prev.mustDraw) return prev;
      const { nextState, tile } = drawFromDeck(prev);
      if (!tile) {
        const emptyDeckState = {
          ...prev,
          turn: owner === 'player' ? 'opponent' : 'player',
          mustDraw: true,
          message: 'Deste boş. Sıra değişti.',
        };
        return playBotTurn(emptyDeckState);
      }

      const drawnState: OkeyState = owner === 'player'
        ? {
            ...nextState,
            playerHand: [...prev.playerHand, tile],
            mustDraw: false,
            message: `Çekilen taş: ${tile.value}`,
          }
        : {
            ...nextState,
            opponentHand: [...prev.opponentHand, tile],
            mustDraw: false,
            message: `${opponentLabel} taş çekti.`,
          };
      return playBotTurn(drawnState);
    });
  };

  const discardTile = (owner: TurnOwner, index: number) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== owner || prev.mustDraw) return prev;
      const hand = owner === 'player' ? prev.playerHand : prev.opponentHand;
      const chosen = hand[index];
      if (!chosen) return prev;
      const nextHand = hand.filter((_, i) => i !== index);
      const won = hasWinningShape(nextHand);

      const baseState: OkeyState = {
        ...prev,
        playerHand: owner === 'player' ? nextHand : prev.playerHand,
        opponentHand: owner === 'opponent' ? nextHand : prev.opponentHand,
        discardPile: [...prev.discardPile, chosen],
        turn: won ? owner : (owner === 'player' ? 'opponent' : 'player'),
        mustDraw: true,
        finished: won,
        winner: won ? (owner === 'player' ? currentUser.username : opponentLabel) : null,
        message: won
          ? `${owner === 'player' ? 'Sen' : opponentLabel} eli tamamladı.`
          : `${owner === 'player' ? 'Sen' : opponentLabel} ${chosen.value} attı.`,
      };

      return playBotTurn(baseState);
    });
  };

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner]);

  const playerScore = calcMeldScore(state.playerHand);
  const opponentScore = calcMeldScore(state.opponentHand);

  return (
    <div className="max-w-5xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
      <div className="rf-terminal-strip mb-2">Sosyal Masa // 101 Okey</div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">101 Okey Sosyal</h2>
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
          <p className="font-semibold text-cyan-200 mt-1">Meld: {playerScore}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{opponentLabel}</p>
          <p className="font-semibold text-cyan-200 mt-1">Meld: {opponentScore}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Deste</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.deck.length}</p>
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-4 pl-3 border-l-2 border-cyan-400/60">{state.message}</p>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--rf-muted)]">Senin Taşların</p>
        <div className="flex flex-wrap gap-2">
          {state.playerHand.map((tile, index) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => discardTile('player', index)}
              disabled={state.turn !== 'player' || state.mustDraw || state.finished}
              className={`w-12 h-16 border text-sm font-bold ${TILE_STYLE[tile.color]} disabled:opacity-45 disabled:cursor-not-allowed`}
            >
              {tile.value}
            </button>
          ))}
        </div>
      </div>

      {!isBot && (
        <div className="space-y-3 mt-5">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--rf-muted)]">{opponentLabel} Taşları (Hotseat)</p>
          <div className="flex flex-wrap gap-2">
            {state.opponentHand.map((tile, index) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => discardTile('opponent', index)}
                disabled={state.turn !== 'opponent' || state.mustDraw || state.finished}
                className={`w-12 h-16 border text-sm font-bold ${TILE_STYLE[tile.color]} disabled:opacity-45 disabled:cursor-not-allowed`}
              >
                {tile.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {!state.finished && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <RetroButton onClick={() => drawTile('player')} disabled={state.turn !== 'player' || !state.mustDraw}>
            Taş Çek
          </RetroButton>
          {!isBot && (
            <RetroButton
              variant="secondary"
              onClick={() => drawTile('opponent')}
              disabled={state.turn !== 'opponent' || !state.mustDraw}
            >
              Rakip Taş Çeksin
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

export default Okey101Social;
