import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';

type UnoColor = 'red' | 'blue' | 'green' | 'yellow';
type TurnOwner = 'player' | 'opponent';

interface UnoCard {
  id: string;
  color: UnoColor;
  number: number;
}

interface UnoSocialProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

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

const UNO_COLORS: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
const COLOR_STYLES: Record<UnoColor, string> = {
  red: 'bg-rose-600/90 border-rose-200/80',
  blue: 'bg-cyan-600/90 border-cyan-200/80',
  green: 'bg-emerald-600/90 border-emerald-200/80',
  yellow: 'bg-amber-500/90 border-amber-100/90 text-[#0a1223]',
};

const shuffle = <T,>(input: T[]): T[] => {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const makeDeck = (): UnoCard[] => {
  const cards: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    for (let n = 0; n <= 9; n += 1) {
      cards.push({ id: `${color}-${n}-a`, color, number: n });
      cards.push({ id: `${color}-${n}-b`, color, number: n });
    }
  }
  return shuffle(cards);
};

const canPlay = (candidate: UnoCard, topCard: UnoCard): boolean =>
  candidate.color === topCard.color || candidate.number === topCard.number;

const drawOne = (state: UnoState): { nextState: UnoState; card: UnoCard | null } => {
  let deck = state.deck.slice();
  let discard = state.discard.slice();
  if (!deck.length && discard.length > 1) {
    const top = discard[discard.length - 1];
    const recyclable = discard.slice(0, -1);
    deck = shuffle(recyclable);
    discard = [top];
  }
  if (!deck.length) {
    return { nextState: { ...state, deck, discard }, card: null };
  }
  const card = deck[0];
  return {
    card,
    nextState: {
      ...state,
      deck: deck.slice(1),
      discard,
    },
  };
};

const initState = (): UnoState => {
  const deck = makeDeck();
  const playerHand = deck.slice(0, 7);
  const opponentHand = deck.slice(7, 14);
  const starter = deck[14];
  const rest = deck.slice(15);

  return {
    deck: rest,
    discard: [starter],
    playerHand,
    opponentHand,
    turn: 'player',
    message: 'Kartını seç ve oyna.',
    finished: false,
    winner: null,
  };
};

export const UnoSocial: React.FC<UnoSocialProps> = ({
  currentUser,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? 'UNO BOT' : (opponentName || 'Arkadaşın')), [isBot, opponentName]);
  const [state, setState] = useState<UnoState>(() => initState());
  const gameEndSentRef = useRef(false);

  const topCard = state.discard[state.discard.length - 1];

  useEffect(() => {
    setState(initState());
    gameEndSentRef.current = false;
  }, [isBot, opponentLabel]);

  const finishGame = (winner: string) => {
    if (gameEndSentRef.current) return;
    gameEndSentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  };

  const applyBotTurn = (sourceState: UnoState) => {
    if (!isBot || sourceState.turn !== 'opponent' || sourceState.finished) return sourceState;
    const currentTop = sourceState.discard[sourceState.discard.length - 1];
    const playableIndex = sourceState.opponentHand.findIndex((card) => canPlay(card, currentTop));

    if (playableIndex >= 0) {
      const chosen = sourceState.opponentHand[playableIndex];
      const nextOpponentHand = sourceState.opponentHand.filter((_, i) => i !== playableIndex);
      const next = {
        ...sourceState,
        opponentHand: nextOpponentHand,
        discard: [...sourceState.discard, chosen],
        turn: 'player' as TurnOwner,
        message: `${opponentLabel} ${chosen.color.toUpperCase()}-${chosen.number} oynadı.`,
      };
      if (!nextOpponentHand.length) {
        return {
          ...next,
          finished: true,
          winner: opponentLabel,
          message: `${opponentLabel} eli bitirdi.`,
        };
      }
      return next;
    }

    const { nextState, card } = drawOne(sourceState);
    if (!card) {
      return {
        ...nextState,
        turn: 'player',
        message: `${opponentLabel} kart çekemedi, sıra sende.`,
      };
    }
    return {
      ...nextState,
      opponentHand: [...sourceState.opponentHand, card],
      turn: 'player',
      message: `${opponentLabel} kart çekti, sıra sende.`,
    };
  };

  const playCard = (owner: TurnOwner, index: number) => {
    setState((prev) => {
      if (prev.finished) return prev;
      if (prev.turn !== owner) return prev;
      const hand = owner === 'player' ? prev.playerHand : prev.opponentHand;
      const chosen = hand[index];
      if (!chosen) return prev;
      const top = prev.discard[prev.discard.length - 1];

      if (!canPlay(chosen, top)) {
        return {
          ...prev,
          message: 'Bu kart üstteki kartla eşleşmiyor.',
        };
      }

      const nextHand = hand.filter((_, i) => i !== index);
      const baseNext: UnoState = {
        ...prev,
        discard: [...prev.discard, chosen],
        playerHand: owner === 'player' ? nextHand : prev.playerHand,
        opponentHand: owner === 'opponent' ? nextHand : prev.opponentHand,
        turn: owner === 'player' ? 'opponent' : 'player',
        message: `${owner === 'player' ? 'Sen' : opponentLabel} ${chosen.color.toUpperCase()}-${chosen.number} oynadı.`,
      };

      if (!nextHand.length) {
        return {
          ...baseNext,
          finished: true,
          winner: owner === 'player' ? currentUser.username : opponentLabel,
          message: `${owner === 'player' ? 'Sen' : opponentLabel} eli bitirdi.`,
        };
      }

      return applyBotTurn(baseNext);
    });
  };

  const drawCard = (owner: TurnOwner) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== owner) return prev;
      const { nextState, card } = drawOne(prev);
      if (!card) {
        const noCardState = {
          ...nextState,
          turn: owner === 'player' ? 'opponent' : 'player',
          message: 'Destede kart kalmadı. Sıra değişti.',
        };
        return applyBotTurn(noCardState);
      }

      const withCard: UnoState = owner === 'player'
        ? {
            ...nextState,
            playerHand: [...prev.playerHand, card],
            turn: 'opponent',
            message: 'Kart çektin. Sıra rakipte.',
          }
        : {
            ...nextState,
            opponentHand: [...prev.opponentHand, card],
            turn: 'player',
            message: `${opponentLabel} kart çekti. Sıra sende.`,
          };
      return applyBotTurn(withCard);
    });
  };

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner]);

  return (
    <div className="max-w-4xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
      <div className="rf-terminal-strip mb-2">Sosyal Masa // UNO</div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">UNO Sosyal</h2>
        <button
          type="button"
          onClick={onLeave}
          className="px-3 py-2 border border-rose-400/45 bg-rose-500/12 text-rose-200 hover:bg-rose-500/24 transition-colors text-xs uppercase tracking-[0.12em]"
        >
          Oyundan Çık
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Sıra</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.turn === 'player' ? 'Sende' : opponentLabel}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Kartların</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.playerHand.length}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{opponentLabel}</p>
          <p className="font-semibold text-cyan-200 mt-1">{state.opponentHand.length}</p>
        </div>
      </div>

      <div className="rf-screen-card-muted p-3 mb-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--rf-muted)] mb-2">Üst Kart</p>
        <div className={`inline-flex items-center justify-center w-16 h-24 border-2 font-bold text-lg ${COLOR_STYLES[topCard.color]}`}>
          {topCard.number}
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-4 pl-3 border-l-2 border-cyan-400/60">{state.message}</p>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--rf-muted)]">Senin Elin</p>
        <div className="flex flex-wrap gap-2">
          {state.playerHand.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => playCard('player', index)}
              disabled={state.turn !== 'player' || state.finished}
              className={`w-12 h-16 border-2 text-sm font-bold transition-transform hover:-translate-y-1 disabled:opacity-45 disabled:cursor-not-allowed ${COLOR_STYLES[card.color]}`}
            >
              {card.number}
            </button>
          ))}
        </div>
      </div>

      {!isBot && (
        <div className="space-y-3 mt-5">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--rf-muted)]">{opponentLabel} Eli (Hotseat)</p>
          <div className="flex flex-wrap gap-2">
            {state.opponentHand.map((card, index) => (
              <button
                key={card.id}
                type="button"
                onClick={() => playCard('opponent', index)}
                disabled={state.turn !== 'opponent' || state.finished}
                className={`w-12 h-16 border-2 text-sm font-bold transition-transform hover:-translate-y-1 disabled:opacity-45 disabled:cursor-not-allowed ${COLOR_STYLES[card.color]}`}
              >
                {card.number}
              </button>
            ))}
          </div>
        </div>
      )}

      {!state.finished && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <RetroButton
            onClick={() => drawCard('player')}
            disabled={state.turn !== 'player'}
          >
            Kart Çek
          </RetroButton>
          {!isBot && (
            <RetroButton
              variant="secondary"
              onClick={() => drawCard('opponent')}
              disabled={state.turn !== 'opponent'}
            >
              Rakip Kart Çeksin
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

export default UnoSocial;
