import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { socketService } from '../lib/socket';
import {
  canPlay,
  COLOR_STYLES,
  drawOne,
  initUnoState,
  type UnoCard,
  type UnoState,
  type UnoTurnOwner as TurnOwner,
} from '../lib/game-logic/unoSocial';

interface UnoSocialProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

export const UnoSocial: React.FC<UnoSocialProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? 'UNO BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);
  const [myRole, setMyRole] = useState<TurnOwner>('host');
  const [state, setState] = useState<UnoState>(() => initUnoState(currentUser.username, opponentLabel));
  const gameEndSentRef = useRef(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot);

  const topCard = state.discard[state.discard.length - 1];
  const isMyTurn = state.turn === myRole;
  const myHand = myRole === 'host' ? state.hostHand : state.guestHand;
  const opponentHandCount = myRole === 'host' ? state.guestHand.length : state.hostHand.length;

  // Determine role
  useEffect(() => {
    if (isBot) {
      setMyRole('host');
      setWaitingForOpponent(false);
      return;
    }
    if (opponentName && opponentName.toLowerCase() !== currentUser.username.toLowerCase()) {
      setMyRole('host');
    } else if (opponentName && opponentName.toLowerCase() === currentUser.username.toLowerCase()) {
      setMyRole('guest');
    } else {
      setMyRole('host');
    }
  }, [isBot, opponentName, currentUser.username]);

  // Initialize state
  useEffect(() => {
    const hostN = myRole === 'host' ? currentUser.username : opponentLabel;
    const guestN = myRole === 'host' ? opponentLabel : currentUser.username;
    const newState = initUnoState(hostN, guestN);
    setState(newState);
    gameEndSentRef.current = false;
    setWaitingForOpponent(!isBot);

    if (!isBot && myRole === 'host' && gameId) {
      setTimeout(() => {
        socketService.emitMove(String(gameId), { type: 'full_state', state: newState });
        setWaitingForOpponent(false);
      }, 1000);
    }
  }, [isBot, opponentLabel, myRole, currentUser.username]);

  // Socket.IO Setup
  useEffect(() => {
    if (isBot || !gameId) return;

    const socket = socketService.getSocket();
    socketService.joinGame(String(gameId));

    const handleOpponentMove = (data: any) => {
      if (!data?.move) return;
      const move = data.move;

      if (move.type === 'full_state') {
        setState(move.state);
        setWaitingForOpponent(false);
      } else if (move.type === 'play_card') {
        setState((prev) => {
          if (prev.finished) return prev;
          const ownerRole = move.owner as TurnOwner;
          const hand = ownerRole === 'host' ? prev.hostHand : prev.guestHand;
          const chosenIndex = hand.findIndex((c: UnoCard) => c.id === move.cardId);
          if (chosenIndex < 0) return prev;
          const chosen = hand[chosenIndex];
          const nextHand = hand.filter((_: UnoCard, i: number) => i !== chosenIndex);
          const nextTurn: TurnOwner = ownerRole === 'host' ? 'guest' : 'host';

          const baseNext: UnoState = {
            ...prev,
            discard: [...prev.discard, chosen],
            hostHand: ownerRole === 'host' ? nextHand : prev.hostHand,
            guestHand: ownerRole === 'guest' ? nextHand : prev.guestHand,
            turn: nextTurn,
            message: `${ownerRole === 'host' ? prev.hostName : prev.guestName} ${chosen.color.toUpperCase()}-${chosen.number} oynadı.`,
          };

          if (!nextHand.length) {
            return {
              ...baseNext,
              finished: true,
              winner: ownerRole === 'host' ? prev.hostName : prev.guestName,
              message: `${ownerRole === 'host' ? prev.hostName : prev.guestName} eli bitirdi.`,
            };
          }
          return baseNext;
        });
      } else if (move.type === 'draw_card') {
        setState((prev) => {
          if (prev.finished) return prev;
          const ownerRole = move.owner as TurnOwner;
          const { nextState, card } = drawOne(prev);
          if (!card) {
            return {
              ...nextState,
              turn: (ownerRole === 'host' ? 'guest' : 'host') as TurnOwner,
              message: 'Destede kart kalmadı. Sıra değişti.',
            };
          }
          const nextTurn: TurnOwner = ownerRole === 'host' ? 'guest' : 'host';
          return {
            ...nextState,
            hostHand: ownerRole === 'host' ? [...prev.hostHand, card] : prev.hostHand,
            guestHand: ownerRole === 'guest' ? [...prev.guestHand, card] : prev.guestHand,
            turn: nextTurn,
            message: `${ownerRole === 'host' ? prev.hostName : prev.guestName} kart çekti.`,
          };
        });
      }
    };

    const handleStateUpdated = (stateData: any) => {
      if (stateData && typeof stateData === 'object' && 'hostHand' in stateData) {
        setState(stateData as UnoState);
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

  // Bot logic
  const applyBotTurn = useCallback((sourceState: UnoState): UnoState => {
    if (!isBot || sourceState.turn !== 'guest' || sourceState.finished) return sourceState;
    const currentTop = sourceState.discard[sourceState.discard.length - 1];
    const playableIndex = sourceState.guestHand.findIndex((card) => canPlay(card, currentTop));

    if (playableIndex >= 0) {
      const chosen = sourceState.guestHand[playableIndex];
      const nextGuestHand = sourceState.guestHand.filter((_, i) => i !== playableIndex);
      const next: UnoState = {
        ...sourceState,
        guestHand: nextGuestHand,
        discard: [...sourceState.discard, chosen],
        turn: 'host',
        message: `${opponentLabel} ${chosen.color.toUpperCase()}-${chosen.number} oynadı.`,
      };
      if (!nextGuestHand.length) {
        return { ...next, finished: true, winner: opponentLabel, message: `${opponentLabel} eli bitirdi.` };
      }
      return next;
    }

    const { nextState, card } = drawOne(sourceState);
    if (!card) {
      return { ...nextState, turn: 'host', message: `${opponentLabel} kart çekemedi, sıra sende.` };
    }
    return {
      ...nextState,
      guestHand: [...sourceState.guestHand, card],
      turn: 'host',
      message: `${opponentLabel} kart çekti, sıra sende.`,
    };
  }, [isBot, opponentLabel]);

  // Player actions
  const playCard = (index: number) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== myRole) return prev;
      const hand = myRole === 'host' ? prev.hostHand : prev.guestHand;
      const chosen = hand[index];
      if (!chosen) return prev;
      const top = prev.discard[prev.discard.length - 1];

      if (!canPlay(chosen, top)) {
        return { ...prev, message: 'Bu kart üstteki kartla eşleşmiyor.' };
      }

      const nextHand = hand.filter((_, i) => i !== index);
      const nextTurn: TurnOwner = myRole === 'host' ? 'guest' : 'host';
      const baseNext: UnoState = {
        ...prev,
        discard: [...prev.discard, chosen],
        hostHand: myRole === 'host' ? nextHand : prev.hostHand,
        guestHand: myRole === 'guest' ? nextHand : prev.guestHand,
        turn: nextTurn,
        message: `Sen ${chosen.color.toUpperCase()}-${chosen.number} oynadın.`,
      };

      // Emit to opponent
      if (!isBot && gameId) {
        socketService.emitMove(String(gameId), {
          type: 'play_card',
          owner: myRole,
          cardId: chosen.id,
          cardColor: chosen.color,
          cardNumber: chosen.number,
        });
      }

      if (!nextHand.length) {
        return {
          ...baseNext,
          finished: true,
          winner: currentUser.username,
          message: 'Sen eli bitirdin!',
        };
      }

      return applyBotTurn(baseNext);
    });
  };

  const drawCard = () => {
    setState((prev) => {
      if (prev.finished || prev.turn !== myRole) return prev;
      const { nextState, card } = drawOne(prev);
      if (!card) {
        const noCardState: UnoState = {
          ...nextState,
          turn: (myRole === 'host' ? 'guest' : 'host') as TurnOwner,
          message: 'Destede kart kalmadı. Sıra değişti.',
        };
        if (!isBot && gameId) {
          socketService.emitMove(String(gameId), { type: 'draw_card', owner: myRole });
        }
        return applyBotTurn(noCardState);
      }

      const nextTurn: TurnOwner = myRole === 'host' ? 'guest' : 'host';
      const withCard: UnoState = {
        ...nextState,
        hostHand: myRole === 'host' ? [...prev.hostHand, card] : prev.hostHand,
        guestHand: myRole === 'guest' ? [...prev.guestHand, card] : prev.guestHand,
        turn: nextTurn,
        message: 'Kart çektin. Sıra rakipte.',
      };

      if (!isBot && gameId) {
        socketService.emitMove(String(gameId), { type: 'draw_card', owner: myRole });
      }

      return applyBotTurn(withCard);
    });
  };

  // Game end
  const finishGame = useCallback((winner: string) => {
    if (gameEndSentRef.current) return;
    gameEndSentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  }, [onGameEnd]);

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner, finishGame]);

  // Waiting screen
  if (waitingForOpponent && !isBot) {
    return (
      <div className="max-w-4xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
        <div className="rf-terminal-strip mb-2">Sosyal Masa // UNO</div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">UNO Sosyal</h2>
          <button type="button" onClick={onLeave} className="px-3 py-2 border border-rose-400/45 bg-rose-500/12 text-rose-200 hover:bg-rose-500/24 transition-colors text-xs uppercase tracking-[0.12em]">
            Oyundan Çık
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-cyan-200 text-lg">Rakip bekleniyor...</p>
        </div>
      </div>
    );
  }

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
          <p className={`font-semibold mt-1 ${isMyTurn ? 'text-emerald-300' : 'text-rose-300'}`}>
            {isMyTurn ? '🃏 Sende' : `⏳ ${opponentLabel}`}
          </p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Kartların</p>
          <p className="font-semibold text-cyan-200 mt-1">{myHand.length}</p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">{opponentLabel}</p>
          <p className="font-semibold text-cyan-200 mt-1">{opponentHandCount} kart</p>
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
          {myHand.map((card, index) => (
            <button
              key={card.id}
              type="button"
              onClick={() => playCard(index)}
              disabled={!isMyTurn || state.finished}
              className={`w-12 h-16 border-2 text-sm font-bold transition-transform hover:-translate-y-1 disabled:opacity-45 disabled:cursor-not-allowed ${COLOR_STYLES[card.color]}`}
            >
              {card.number}
            </button>
          ))}
        </div>
      </div>

      {!state.finished && (
        <div className="mt-5">
          <RetroButton onClick={drawCard} disabled={!isMyTurn}>
            {isMyTurn ? 'Kart Çek' : `⏳ ${opponentLabel} oynuyor...`}
          </RetroButton>
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
