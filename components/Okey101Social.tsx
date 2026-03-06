import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { socketService } from '../lib/socket';
import {
  calcMeldScore,
  drawFromDeck,
  hasWinningShape,
  initOkeyState,
  TILE_STYLE,
  type OkeyState,
  type OkeyTile,
  type OkeyTurnOwner as TurnOwner,
} from '../lib/game-logic/okey101Social';

interface Okey101SocialProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

export const Okey101Social: React.FC<Okey101SocialProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const opponentLabel = useMemo(() => (isBot ? '101 BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);
  const [myRole, setMyRole] = useState<TurnOwner>('host');
  const [state, setState] = useState<OkeyState>(() => initOkeyState(currentUser.username, opponentLabel));
  const sentRef = useRef(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot);

  const isMyTurn = state.turn === myRole;
  const myHand = myRole === 'host' ? state.hostHand : state.guestHand;
  const myScore = calcMeldScore(myHand);
  const opponentHandCount = myRole === 'host' ? state.guestHand.length : state.hostHand.length;
  const opponentScore = myRole === 'host' ? calcMeldScore(state.guestHand) : calcMeldScore(state.hostHand);

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
    const newState = initOkeyState(hostN, guestN);
    setState(newState);
    sentRef.current = false;
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
      } else if (move.type === 'draw_tile') {
        setState((prev) => {
          if (prev.finished) return prev;
          const ownerRole = move.owner as TurnOwner;
          const { nextState, tile } = drawFromDeck(prev);
          if (!tile) {
            return {
              ...nextState,
              turn: (ownerRole === 'host' ? 'guest' : 'host') as TurnOwner,
              mustDraw: true,
              message: 'Deste bitti, sıra sende.',
            };
          }
          return {
            ...nextState,
            hostHand: ownerRole === 'host' ? [...prev.hostHand, tile] : prev.hostHand,
            guestHand: ownerRole === 'guest' ? [...prev.guestHand, tile] : prev.guestHand,
            mustDraw: false,
            message: `${ownerRole === 'host' ? prev.hostName : prev.guestName} taş çekti.`,
          };
        });
      } else if (move.type === 'discard_tile') {
        setState((prev) => {
          if (prev.finished) return prev;
          const ownerRole = move.owner as TurnOwner;
          const hand = ownerRole === 'host' ? prev.hostHand : prev.guestHand;
          const tileId = move.tileId as string;
          const chosenIndex = hand.findIndex((t: OkeyTile) => t.id === tileId);
          if (chosenIndex < 0) return prev;
          const chosen = hand[chosenIndex];
          const nextHand = hand.filter((_: OkeyTile, i: number) => i !== chosenIndex);
          const won = hasWinningShape(nextHand);
          const nextTurn: TurnOwner = won ? ownerRole : (ownerRole === 'host' ? 'guest' : 'host');

          return {
            ...prev,
            hostHand: ownerRole === 'host' ? nextHand : prev.hostHand,
            guestHand: ownerRole === 'guest' ? nextHand : prev.guestHand,
            discardPile: [...prev.discardPile, chosen],
            turn: nextTurn,
            mustDraw: true,
            finished: won,
            winner: won ? (ownerRole === 'host' ? prev.hostName : prev.guestName) : null,
            message: won
              ? `${ownerRole === 'host' ? prev.hostName : prev.guestName} eli tamamladı.`
              : `${ownerRole === 'host' ? prev.hostName : prev.guestName} ${chosen.value} attı.`,
          };
        });
      }
    };

    const handleStateUpdated = (stateData: any) => {
      if (stateData && typeof stateData === 'object' && 'hostHand' in stateData) {
        setState(stateData as OkeyState);
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
  const playBotTurn = useCallback((source: OkeyState): OkeyState => {
    if (!isBot || source.turn !== 'guest' || source.finished) return source;
    let working = source;

    if (working.mustDraw) {
      const { nextState, tile } = drawFromDeck(working);
      if (!tile) {
        return { ...working, turn: 'host', mustDraw: true, message: 'Deste bitti, sıra sende.' };
      }
      working = {
        ...nextState,
        guestHand: [...working.guestHand, tile],
        mustDraw: false,
        message: `${opponentLabel} taş çekti.`,
      };
    }

    const discardIndex = Math.floor(Math.random() * working.guestHand.length);
    const discardTile = working.guestHand[discardIndex];
    const nextHand = working.guestHand.filter((_, i) => i !== discardIndex);
    const won = hasWinningShape(nextHand);
    return {
      ...working,
      guestHand: nextHand,
      discardPile: [...working.discardPile, discardTile],
      turn: won ? 'guest' : 'host',
      mustDraw: true,
      finished: won,
      winner: won ? opponentLabel : null,
      message: won ? `${opponentLabel} eli tamamladı.` : `${opponentLabel} ${discardTile.value} attı. Sıra sende.`,
    };
  }, [isBot, opponentLabel]);

  // Player actions
  const drawTile = () => {
    setState((prev) => {
      if (prev.finished || prev.turn !== myRole || !prev.mustDraw) return prev;
      const { nextState, tile } = drawFromDeck(prev);
      if (!tile) {
        const emptyDeckState: OkeyState = {
          ...prev,
          turn: (myRole === 'host' ? 'guest' : 'host') as TurnOwner,
          mustDraw: true,
          message: 'Deste boş. Sıra değişti.',
        };
        if (!isBot && gameId) {
          socketService.emitMove(String(gameId), { type: 'draw_tile', owner: myRole });
        }
        return playBotTurn(emptyDeckState);
      }

      const drawnState: OkeyState = {
        ...nextState,
        hostHand: myRole === 'host' ? [...prev.hostHand, tile] : prev.hostHand,
        guestHand: myRole === 'guest' ? [...prev.guestHand, tile] : prev.guestHand,
        mustDraw: false,
        message: `Çekilen taş: ${tile.value}`,
      };

      if (!isBot && gameId) {
        socketService.emitMove(String(gameId), { type: 'draw_tile', owner: myRole });
      }

      return playBotTurn(drawnState);
    });
  };

  const discardTile = (index: number) => {
    setState((prev) => {
      if (prev.finished || prev.turn !== myRole || prev.mustDraw) return prev;
      const hand = myRole === 'host' ? prev.hostHand : prev.guestHand;
      const chosen = hand[index];
      if (!chosen) return prev;
      const nextHand = hand.filter((_, i) => i !== index);
      const won = hasWinningShape(nextHand);
      const nextTurn: TurnOwner = won ? myRole : (myRole === 'host' ? 'guest' : 'host');

      const baseState: OkeyState = {
        ...prev,
        hostHand: myRole === 'host' ? nextHand : prev.hostHand,
        guestHand: myRole === 'guest' ? nextHand : prev.guestHand,
        discardPile: [...prev.discardPile, chosen],
        turn: nextTurn,
        mustDraw: true,
        finished: won,
        winner: won ? currentUser.username : null,
        message: won ? 'Sen eli tamamladın!' : `Sen ${chosen.value} attın.`,
      };

      if (!isBot && gameId) {
        socketService.emitMove(String(gameId), { type: 'discard_tile', owner: myRole, tileId: chosen.id });
      }

      return playBotTurn(baseState);
    });
  };

  // Game end
  const finishGame = useCallback((winner: string) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setTimeout(() => onGameEnd(winner, 0), 700);
  }, [onGameEnd]);

  useEffect(() => {
    if (!state.finished || !state.winner) return;
    finishGame(state.winner);
  }, [state.finished, state.winner, finishGame]);

  // Waiting screen
  if (waitingForOpponent && !isBot) {
    return (
      <div className="max-w-5xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white">
        <div className="rf-terminal-strip mb-2">Sosyal Masa // 101 Okey</div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display-tr text-2xl sm:text-3xl tracking-[0.08em] uppercase">101 Okey Sosyal</h2>
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
          <p className={`font-semibold mt-1 ${isMyTurn ? 'text-emerald-300' : 'text-rose-300'}`}>
            {isMyTurn ? '🀄 Sende' : `⏳ ${opponentLabel}`}
          </p>
        </div>
        <div className="rf-screen-card-muted p-3">
          <p className="text-xs text-[var(--rf-muted)] uppercase tracking-[0.12em]">Sen</p>
          <p className="font-semibold text-cyan-200 mt-1">Meld: {myScore}</p>
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
          {myHand.map((tile, index) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => discardTile(index)}
              disabled={!isMyTurn || state.mustDraw || state.finished}
              className={`w-12 h-16 border text-sm font-bold ${TILE_STYLE[tile.color]} disabled:opacity-45 disabled:cursor-not-allowed`}
            >
              {tile.value}
            </button>
          ))}
        </div>
      </div>

      {!state.finished && (
        <div className="mt-5">
          <RetroButton onClick={drawTile} disabled={!isMyTurn || !state.mustDraw}>
            {isMyTurn && state.mustDraw ? 'Taş Çek' : isMyTurn ? 'Taş At' : `⏳ ${opponentLabel} oynuyor...`}
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

export default Okey101Social;
