import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move, Square } from 'chess.js';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';

interface RetroChessProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface ChessRealtimeState {
  fen?: string;
  turn?: 'w' | 'b';
  isGameOver?: boolean;
  result?: string | null;
  winner?: string | null;
  timedOutColor?: 'w' | 'b' | null;
  clock?: {
    baseMs?: number;
    incrementMs?: number;
    whiteMs?: number;
    blackMs?: number;
    label?: string;
    lastTickAt?: string | null;
  };
  moveHistory?: Array<{
    from: string;
    to: string;
    san: string;
    ts: string;
    spentMs?: number;
    remainingMs?: number;
  }>;
  drawOffer?: {
    status?: string;
    offeredBy?: string;
    createdAt?: string;
    respondedBy?: string;
    respondedAt?: string;
  };
}

interface GameSnapshot {
  id: string | number;
  status?: string;
  winner?: string | null;
  hostName?: string;
  guestName?: string | null;
  gameState?: {
    chess?: ChessRealtimeState;
  };
}

interface GameStateUpdatedPayload {
  type?: string;
  gameId?: string | number;
  status?: string;
  winner?: string | null;
  chess?: ChessRealtimeState;
  drawOffer?: DrawOfferState | null;
  gameState?: {
    chess?: ChessRealtimeState;
  };
  action?: string;
}

interface DrawOfferState {
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  offeredBy: string;
  createdAt: string;
  respondedBy?: string;
  respondedAt?: string;
}

const DRAW_OFFER_STATUSES = new Set(['pending', 'accepted', 'rejected', 'cancelled']);

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

const PIECE_SYMBOL: Record<'w' | 'b', Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k', string>> = {
  w: {
    p: '♙',
    n: '♘',
    b: '♗',
    r: '♖',
    q: '♕',
    k: '♔',
  },
  b: {
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚',
  },
};

const PIECE_LABEL: Record<'p' | 'n' | 'b' | 'r' | 'q' | 'k', string> = {
  p: 'Piyon',
  n: 'At',
  b: 'Fil',
  r: 'Kale',
  q: 'Vezir',
  k: 'Şah',
};

const normalizeWinner = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  return raw ? raw : null;
};

const loadChess = (fen: unknown) => {
  try {
    const resolvedFen = String(fen || '').trim();
    if (!resolvedFen) return new Chess();
    return new Chess(resolvedFen);
  } catch {
    return new Chess();
  }
};

const toSquare = (file: string, rank: string) => `${file}${rank}` as Square;

const inferResultLabel = (engine: Chess): string => {
  if (engine.isCheckmate()) return 'Şah mat';
  if (engine.isStalemate()) return 'Pat';
  if (engine.isThreefoldRepetition()) return 'Üçlü tekrar';
  if (engine.isInsufficientMaterial()) return 'Yetersiz materyal';
  if (engine.isDraw()) return 'Berabere';
  return 'Oyun bitti';
};

const formatClock = (rawMs: number): string => {
  const ms = Math.max(0, Math.floor(Number(rawMs) || 0));
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const parseRetryAfterMs = (message: string): number => {
  const found = message.match(/(\d+)\s*sn/i);
  const seconds = found ? Number(found[1]) : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
};

const normalizeDrawOfferState = (value: unknown): DrawOfferState | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const statusRaw = String(source.status || '').trim().toLowerCase();
  const offeredBy = String(source.offeredBy || '').trim();
  if (!offeredBy || !DRAW_OFFER_STATUSES.has(statusRaw)) return null;
  const createdAt = String(source.createdAt || '').trim() || new Date().toISOString();

  return {
    status: statusRaw as DrawOfferState['status'],
    offeredBy,
    createdAt,
    respondedBy: source.respondedBy ? String(source.respondedBy) : undefined,
    respondedAt: source.respondedAt ? String(source.respondedAt) : undefined,
  };
};

export const RetroChess: React.FC<RetroChessProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [serverStatus, setServerStatus] = useState('active');
  const [serverWinner, setServerWinner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('Klasik satranç modu: taş seç, hedef kareye tıkla.');
  const [liveResultLabel, setLiveResultLabel] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveLog, setMoveLog] = useState<Array<{
    from: string;
    to: string;
    san: string;
    ts: string;
    spentMs?: number;
    remainingMs?: number;
  }>>([]);
  const [clockState, setClockState] = useState<{
    whiteMs: number;
    blackMs: number;
    incrementMs: number;
    label: string;
    lastTickAt: string | null;
  }>({
    whiteMs: 3 * 60 * 1000,
    blackMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
    label: '3+2',
    lastTickAt: null,
  });
  const [displayClock, setDisplayClock] = useState<{ white: number; black: number }>({
    white: 3 * 60 * 1000,
    black: 3 * 60 * 1000,
  });
  const [drawOffer, setDrawOffer] = useState<DrawOfferState | null>(null);
  const concludeRef = useRef(false);
  const pollingRef = useRef<number | null>(null);
  const requestInFlightRef = useRef(false);
  const pollPauseUntilRef = useRef(0);
  const lastRealtimeAtRef = useRef(0);
  const chessFenRef = useRef<string>(chess.fen());

  useEffect(() => {
    chessFenRef.current = chess.fen();
  }, [chess]);

  const playerColor = useMemo<'w' | 'b' | null>(() => {
    if (isBot) return 'w';
    const actor = String(currentUser.username || '').trim().toLowerCase();
    if (hostName && actor === hostName.toLowerCase()) return 'w';
    if (guestName && actor === guestName.toLowerCase()) return 'b';
    return null;
  }, [currentUser.username, guestName, hostName, isBot]);

  const orientation = playerColor === 'b' ? 'b' : 'w';
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === 'w' ? [...RANKS] : [...RANKS].reverse();
  const turn = chess.turn();
  const effectiveSelectableColor = playerColor || turn;
  const isMyTurn = Boolean(playerColor) && turn === playerColor && serverStatus !== 'finished';
  const opponentLabel = useMemo(() => {
    if (isBot) return 'BOT';
    if (playerColor === 'w') return guestName || opponentName || 'Rakip';
    return hostName || opponentName || 'Rakip';
  }, [guestName, hostName, isBot, opponentName, playerColor]);
  const actorKey = String(currentUser.username || '').trim().toLowerCase();
  const pendingDrawOffer = drawOffer && drawOffer.status === 'pending' ? drawOffer : null;
  const isPendingOfferByActor = Boolean(
    pendingDrawOffer &&
    actorKey &&
    pendingDrawOffer.offeredBy.trim().toLowerCase() === actorKey
  );
  const isPendingOfferByOpponent = Boolean(pendingDrawOffer) && !isPendingOfferByActor;
  const canUseChessMatchActions =
    Boolean(gameId) && !isBot && Boolean(playerColor) && serverStatus !== 'finished';

  const clearSelection = () => {
    setSelectedSquare(null);
    setLegalTargets([]);
  };

  const concludeGame = useCallback((winnerFromState: string | null, engine: Chess) => {
    if (concludeRef.current) return;
    concludeRef.current = true;
    const winner = normalizeWinner(winnerFromState);
    const didWin = winner ? winner.toLowerCase() === currentUser.username.toLowerCase() : false;
    const points = didWin ? 12 : 0;
    const label = winner ? `${winner} kazandı.` : `${inferResultLabel(engine)} ile bitti.`;
    setMessage(label);
    setLiveResultLabel(winner ? 'Kazanan belirlendi' : inferResultLabel(engine));
    if (!isBot && gameId) {
      void api.games
        .finish(gameId, winner || '')
        .catch((err) => {
          console.error('RetroChess finish sync failed', err);
        });
    }
    window.setTimeout(() => onGameEnd(winner || 'Berabere', points), 700);
  }, [currentUser.username, gameId, isBot, onGameEnd]);

  const applyGameSnapshot = useCallback((snapshot: GameSnapshot) => {
    if (snapshot.hostName) setHostName(String(snapshot.hostName));
    if (snapshot.guestName) setGuestName(String(snapshot.guestName));
    if (snapshot.status) setServerStatus(String(snapshot.status));
    const winner = normalizeWinner(snapshot.winner || snapshot.gameState?.chess?.winner);
    if (winner) setServerWinner(winner);
    const snapshotDrawOffer = normalizeDrawOfferState(snapshot.gameState?.chess?.drawOffer);
    setDrawOffer(snapshotDrawOffer);
    const incomingMoves = Array.isArray(snapshot.gameState?.chess?.moveHistory)
      ? snapshot.gameState?.chess?.moveHistory
      : [];
    setMoveLog(incomingMoves.slice(-200));
    
    // Track last move for highlighting
    if (incomingMoves.length > 0) {
      const lastMoveEntry = incomingMoves[incomingMoves.length - 1];
      setLastMove({ from: lastMoveEntry.from as Square, to: lastMoveEntry.to as Square });
    }

    const incomingClock = snapshot.gameState?.chess?.clock;
    if (incomingClock && typeof incomingClock === 'object') {
      setClockState({
        whiteMs: Math.max(0, Number(incomingClock.whiteMs || 0)),
        blackMs: Math.max(0, Number(incomingClock.blackMs || 0)),
        incrementMs: Math.max(0, Number(incomingClock.incrementMs || 0)),
        label: String(incomingClock.label || '3+2'),
        lastTickAt: incomingClock.lastTickAt ? String(incomingClock.lastTickAt) : null,
      });
    }

    const nextEngine = loadChess(snapshot.gameState?.chess?.fen);
    const nextFen = nextEngine.fen();
    const hasBoardChanged = chessFenRef.current !== nextFen;
    if (hasBoardChanged) {
      setChess(nextEngine);
      chessFenRef.current = nextFen;
      clearSelection();
    }

    const gameOverByServer = String(snapshot.status || '').toLowerCase() === 'finished';
    const gameOverByBoard =
      Boolean(snapshot.gameState?.chess?.isGameOver) || nextEngine.isGameOver();
    if (gameOverByServer || gameOverByBoard) {
      concludeGame(winner, nextEngine);
      return;
    }

    const whoseTurn = nextEngine.turn() === 'w' ? 'Beyaz' : 'Siyah';
    setMessage(`Sıra: ${whoseTurn}.`);
  }, [concludeGame]);

  const fetchGameSnapshot = useCallback(async (silent = false) => {
    if (!gameId || isBot || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const snapshot = await api.games.get(gameId) as GameSnapshot;
      applyGameSnapshot(snapshot);
    } catch (err) {
      console.error('RetroChess snapshot fetch failed', err);
      const errMessage = err instanceof Error ? err.message : '';
      if (errMessage) {
        const retryAfterMs = parseRetryAfterMs(errMessage);
        if (retryAfterMs > 0) {
          pollPauseUntilRef.current = Date.now() + retryAfterMs;
        }
      }
      if (!silent) {
        setMessage(err instanceof Error && err.message ? err.message : 'Oyun durumu alınamadı. Bağlantı yeniden deneniyor...');
      }
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [applyGameSnapshot, gameId, isBot]);

  useEffect(() => {
    concludeRef.current = false;
    setServerWinner(null);
    setLiveResultLabel(null);
    setMoveLog([]);
    setLastMove(null);
    setClockState({
      whiteMs: 3 * 60 * 1000,
      blackMs: 3 * 60 * 1000,
      incrementMs: 2 * 1000,
      label: '3+2',
      lastTickAt: null,
    });
    setDisplayClock({ white: 3 * 60 * 1000, black: 3 * 60 * 1000 });
    pollPauseUntilRef.current = 0;
    lastRealtimeAtRef.current = 0;
    setDrawOffer(null);
    clearSelection();
    if (isBot || !gameId) {
      setHostName(currentUser.username);
      setGuestName('BOT');
      setServerStatus('active');
      setLoading(false);
      setChess(new Chess());
      setMessage('BOT modu: beyaz taşlarla başlıyorsun.');
      return;
    }
    void fetchGameSnapshot();
  }, [currentUser.username, fetchGameSnapshot, gameId, isBot]);

  useEffect(() => {
    if (isBot || !gameId) return;
    const socket = socketService.getSocket();
    socketService.joinGame(String(gameId));

    const handleRealtime = (payload: GameStateUpdatedPayload) => {
      if (String(payload?.gameId || '') !== String(gameId)) return;
      lastRealtimeAtRef.current = Date.now();

      if (payload.type === 'draw_offer_updated') {
        const incomingOffer = normalizeDrawOfferState(
          payload.drawOffer || payload.gameState?.chess?.drawOffer || payload.chess?.drawOffer
        );
        setDrawOffer(incomingOffer);
        if (incomingOffer?.status === 'pending') {
          const byActor =
            actorKey &&
            incomingOffer.offeredBy.trim().toLowerCase() === actorKey;
          setMessage(
            byActor
              ? 'Beraberlik teklifin gönderildi. Rakibin yanıtı bekleniyor.'
              : 'Rakibin beraberlik teklifi gönderdi.'
          );
        }
        if (incomingOffer?.status === 'rejected') {
          setMessage('Beraberlik teklifi reddedildi.');
        }
        if (incomingOffer?.status === 'cancelled') {
          setMessage('Beraberlik teklifi geri çekildi.');
        }
        return;
      }

      if (payload.type === 'game_joined') {
        setMessage('Rakip oyuna bağlandı. Satranç başladı.');
        void fetchGameSnapshot(true);
        return;
      }

      if (payload.type === 'game_finished') {
        setServerStatus('finished');
        setServerWinner(normalizeWinner(payload.winner));
        const incomingOffer = normalizeDrawOfferState(
          payload.drawOffer || payload.gameState?.chess?.drawOffer || payload.chess?.drawOffer
        );
        setDrawOffer(incomingOffer);
        void fetchGameSnapshot(true);
        return;
      }

      if (payload.chess?.fen) {
        if (Array.isArray(payload.chess.moveHistory)) {
          setMoveLog(payload.chess.moveHistory.slice(-200));
          // Track last move for highlighting
          if (payload.chess.moveHistory.length > 0) {
            const lastMoveEntry = payload.chess.moveHistory[payload.chess.moveHistory.length - 1];
            setLastMove({ from: lastMoveEntry.from as Square, to: lastMoveEntry.to as Square });
          }
        }
        if (payload.chess.clock && typeof payload.chess.clock === 'object') {
          setClockState({
            whiteMs: Math.max(0, Number(payload.chess.clock.whiteMs || 0)),
            blackMs: Math.max(0, Number(payload.chess.clock.blackMs || 0)),
            incrementMs: Math.max(0, Number(payload.chess.clock.incrementMs || 0)),
            label: String(payload.chess.clock.label || '3+2'),
            lastTickAt: payload.chess.clock.lastTickAt ? String(payload.chess.clock.lastTickAt) : null,
          });
        }
        const engine = loadChess(payload.chess.fen);
        const nextFen = engine.fen();
        const hasBoardChanged = chessFenRef.current !== nextFen;
        if (hasBoardChanged) {
          setChess(engine);
          chessFenRef.current = nextFen;
          clearSelection();
        }
        if (payload.status) setServerStatus(String(payload.status));
        const winner = normalizeWinner(payload.winner || payload.chess.winner);
        if (winner) setServerWinner(winner);
        const incomingOffer = normalizeDrawOfferState(
          payload.drawOffer || payload.gameState?.chess?.drawOffer || payload.chess.drawOffer
        );
        setDrawOffer(incomingOffer);
        if (payload.chess.isGameOver || engine.isGameOver() || payload.status === 'finished') {
          concludeGame(winner, engine);
          return;
        }
        setMessage(`Sıra: ${engine.turn() === 'w' ? 'Beyaz' : 'Siyah'}.`);
      }
    };

    socket.on('game_state_updated', handleRealtime);
    return () => {
      socket.off('game_state_updated', handleRealtime);
    };
  }, [actorKey, concludeGame, fetchGameSnapshot, gameId, isBot]);

  useEffect(() => {
    // Önce eski interval'ı temizle
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    if (isBot || !gameId) return;
    
    pollingRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (serverStatus === 'finished') return;
      if (Date.now() < pollPauseUntilRef.current) return;
      if (Date.now() - lastRealtimeAtRef.current < 8000) return;
      void fetchGameSnapshot(true);
    }, 5000);
    
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchGameSnapshot, gameId, isBot, serverStatus]);

  useEffect(() => {
    const tick = () => {
      const whiteBase = Math.max(0, Number(clockState.whiteMs || 0));
      const blackBase = Math.max(0, Number(clockState.blackMs || 0));
      const startedAt = clockState.lastTickAt ? Date.parse(clockState.lastTickAt) : NaN;
      const elapsed = Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0;

      if (serverStatus === 'finished') {
        setDisplayClock({ white: whiteBase, black: blackBase });
        return;
      }

      if (turn === 'w') {
        setDisplayClock({ white: Math.max(0, whiteBase - elapsed), black: blackBase });
      } else {
        setDisplayClock({ white: whiteBase, black: Math.max(0, blackBase - elapsed) });
      }
    };

    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [clockState, serverStatus, turn]);

  const runBotMove = useCallback((engineAfterPlayerMove: Chess) => {
    if (!isBot) return;
    const legal = engineAfterPlayerMove.moves({ verbose: true }) as Move[];
    if (legal.length === 0) {
      concludeGame(null, engineAfterPlayerMove);
      return;
    }
    window.setTimeout(() => {
      const picked = legal[Math.floor(Math.random() * legal.length)];
      engineAfterPlayerMove.move({
        from: picked.from,
        to: picked.to,
        promotion: picked.promotion || 'q',
      });
      const cloned = loadChess(engineAfterPlayerMove.fen());
      setChess(cloned);
      clearSelection();
      if (cloned.isGameOver()) {
        concludeGame(null, cloned);
        return;
      }
      setMessage('BOT hamlesini yaptı. Sıra sende.');
    }, 450);
  }, [concludeGame, isBot]);

  const submitMove = useCallback(async (from: Square, to: Square) => {
    if (submitting || serverStatus === 'finished') return;
    const movingPiece = chess.get(from);
    if (!movingPiece) return;
    const promotion = movingPiece.type === 'p' && (to.endsWith('8') || to.endsWith('1')) ? 'q' : undefined;

    // Track last move for highlighting
    setLastMove({ from, to });

    if (isBot || !gameId) {
      const sandbox = loadChess(chess.fen());
      const applied = sandbox.move({ from, to, ...(promotion ? { promotion } : {}) });
      if (!applied) {
        playGameSfx('fail', 0.25);
        setMessage('Yasadışı hamle.');
        setLastMove(null);
        return;
      }
      const cloned = loadChess(sandbox.fen());
      setChess(cloned);
      clearSelection();
      playGameSfx('success', 0.25);
      if (cloned.isGameOver()) {
        concludeGame(null, cloned);
        return;
      }
      setMessage('Hamlen kabul edildi. BOT düşünüyor...');
      runBotMove(sandbox);
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.games.move(gameId, {
        chessMove: { from, to, ...(promotion ? { promotion } : {}) },
      }) as {
        gameState?: { chess?: ChessRealtimeState };
        status?: string;
        winner?: string | null;
      };

      const nextFen = result?.gameState?.chess?.fen;
      const engine = loadChess(nextFen || chess.fen());
      setChess(engine);
      if (Array.isArray(result?.gameState?.chess?.moveHistory)) {
        setMoveLog(result.gameState.chess.moveHistory.slice(-200));
        // Last move is already set before the API call
      }
      if (result?.gameState?.chess?.clock && typeof result.gameState.chess.clock === 'object') {
        setClockState({
          whiteMs: Math.max(0, Number(result.gameState.chess.clock.whiteMs || 0)),
          blackMs: Math.max(0, Number(result.gameState.chess.clock.blackMs || 0)),
          incrementMs: Math.max(0, Number(result.gameState.chess.clock.incrementMs || 0)),
          label: String(result.gameState.chess.clock.label || '3+2'),
          lastTickAt: result.gameState.chess.clock.lastTickAt ? String(result.gameState.chess.clock.lastTickAt) : null,
        });
      }
      clearSelection();
      if (result?.status) setServerStatus(result.status);
      const winner = normalizeWinner(result?.winner || result?.gameState?.chess?.winner);
      if (winner) setServerWinner(winner);
      playGameSfx('success', 0.22);
      if (result?.gameState?.chess?.isGameOver || result?.status === 'finished' || engine.isGameOver()) {
        concludeGame(winner, engine);
        return;
      }
      setMessage(`Hamle gönderildi. Sıra: ${engine.turn() === 'w' ? 'Beyaz' : 'Siyah'}.`);
    } catch (err) {
      playGameSfx('fail', 0.24);
      const messageText =
        err instanceof Error && err.message ? err.message : 'Hamle gönderilemedi.';
      setMessage(messageText);
      const retryAfterMs = parseRetryAfterMs(messageText);
      if (retryAfterMs > 0) {
        pollPauseUntilRef.current = Date.now() + retryAfterMs;
      }
      void fetchGameSnapshot(true);
    } finally {
      setSubmitting(false);
    }
  }, [chess, concludeGame, fetchGameSnapshot, gameId, isBot, runBotMove, serverStatus, submitting]);

  const submitDrawOffer = useCallback(async (action: 'offer' | 'accept' | 'reject' | 'cancel') => {
    if (!canUseChessMatchActions || submitting || !gameId) return;
    setSubmitting(true);
    try {
      const result = await api.games.drawOffer(gameId, action);
      const nextOffer = normalizeDrawOfferState(result.drawOffer);
      setDrawOffer(nextOffer);

      if (result.draw) {
        setServerStatus('finished');
        setServerWinner(normalizeWinner(result.winner));
        setMessage('Beraberlik kabul edildi. Oyun berabere bitti.');
        void fetchGameSnapshot(true);
        return;
      }

      if (action === 'offer') {
        setMessage('Beraberlik teklifi gönderildi. Rakibin yanıtı bekleniyor.');
      } else if (action === 'accept') {
        setMessage('Beraberlik teklifi kabul edildi.');
      } else if (action === 'reject') {
        setMessage('Beraberlik teklifini reddettin.');
      } else if (action === 'cancel') {
        setMessage('Beraberlik teklifini geri çektin.');
      }
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : 'Beraberlik işlemi yapılamadı.');
      void fetchGameSnapshot(true);
    } finally {
      setSubmitting(false);
    }
  }, [canUseChessMatchActions, fetchGameSnapshot, gameId, submitting]);

  const resignAndLeave = useCallback(async (leaveAfterResign = false) => {
    if (!gameId || isBot || !playerColor || serverStatus === 'finished') {
      if (leaveAfterResign) onLeave();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await api.games.resign(gameId);
      const winner = normalizeWinner(result.winner);
      setServerStatus('finished');
      setServerWinner(winner);
      setDrawOffer(null);
      setMessage('Oyundan ayrıldın ve teslim oldun.');
      void fetchGameSnapshot(true);
      if (leaveAfterResign) {
        onLeave();
      }
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : 'Teslim olma işlemi başarısız.');
    } finally {
      setSubmitting(false);
    }
  }, [fetchGameSnapshot, gameId, isBot, onLeave, playerColor, serverStatus, submitting]);

  const handleLeave = useCallback(() => {
    if (canUseChessMatchActions) {
      void resignAndLeave(true);
      return;
    }
    onLeave();
  }, [canUseChessMatchActions, onLeave, resignAndLeave]);

  const handleSquareClick = (square: Square) => {
    if (submitting || serverStatus === 'finished') return;
    if (!isBot && playerColor && !isMyTurn) {
      setMessage('Sıra rakipte.');
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      void submitMove(selectedSquare, square);
      return;
    }

    const piece = chess.get(square);
    if (!piece) {
      clearSelection();
      return;
    }
    if (!isBot && piece.color !== effectiveSelectableColor) {
      setMessage(playerColor ? 'Kendi taşını seçmelisin.' : 'Sırası gelen renkten bir taş seç.');
      return;
    }
    if (isBot && piece.color !== 'w') {
      setMessage('BOT modunda beyaz taşlarla oynuyorsun.');
      return;
    }

    const legal = chess
      .moves({ square, verbose: true })
      .map((mv) => mv.to as Square);
    if (legal.length === 0) {
      clearSelection();
      return;
    }
    setSelectedSquare(square);
    setLegalTargets(legal);
  };

  const turnLabel = turn === 'w' ? 'Beyaz' : 'Siyah';
  const moveCount = chess.history().length;
  const statusLabel = serverStatus === 'finished' ? 'Bitti' : 'Aktif';

  return (
    <div
      className="max-w-4xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white relative overflow-hidden"
      data-testid="retro-chess"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(3, 16, 40, 0.94), rgba(4, 28, 56, 0.9)), url('${GAME_ASSETS.backgrounds.strategyChess}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_95%,rgba(34,211,238,0.09)_100%)] [background-size:100%_4px] opacity-60" />

      <div className="relative z-10">
        <div className="rf-terminal-strip mb-2">Sistem TR-X // Satranç Çekirdeği</div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] leading-none">
            Retro Satranç (Klasik)
          </h2>
          <button
            onClick={handleLeave}
            className="text-rose-200 hover:text-rose-100 text-xs px-3 py-2 border border-rose-400/45 bg-rose-500/12 hover:bg-rose-500/24 transition-colors uppercase tracking-[0.16em]"
          >
            Oyundan Çık
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Durum</div>
            <div className="font-bold text-cyan-100">{statusLabel}</div>
          </div>
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Sıra</div>
            <div className="font-bold text-cyan-100">{turnLabel}</div>
          </div>
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Tempo</div>
            <div className="font-bold text-cyan-100">{clockState.label}</div>
          </div>
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Rakip</div>
            <div className="font-bold truncate text-cyan-100">{opponentLabel}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-center">
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Beyaz Süre</div>
            <div className="font-bold text-cyan-100">{formatClock(displayClock.white)}</div>
          </div>
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Hamle</div>
            <div className="font-bold text-cyan-100">{moveCount}</div>
          </div>
          <div className="rf-screen-card-muted p-3">
            <div className="text-xs text-[var(--rf-muted)]">Siyah Süre</div>
            <div className="font-bold text-cyan-100">{formatClock(displayClock.black)}</div>
          </div>
        </div>

        <p className="text-sm text-[var(--rf-muted)] mb-1 pl-3 border-l-2 border-cyan-400/55">{message}</p>
        {liveResultLabel && (
          <p className="text-xs text-cyan-200 mb-3">{liveResultLabel}</p>
        )}
        {serverWinner && (
          <p className="text-xs text-emerald-300 mb-3">Kazanan: {serverWinner}</p>
        )}
        {pendingDrawOffer && (
          <p className="text-xs text-cyan-200 mb-3">
            {isPendingOfferByActor
              ? 'Gönderdiğin beraberlik teklifi için rakip yanıtı bekleniyor.'
              : `${pendingDrawOffer.offeredBy} beraberlik teklifi gönderdi.`}
          </p>
        )}

        <div className="w-full max-w-[620px] mx-auto border border-cyan-300/22 p-2 sm:p-3 bg-[#06132b]/85 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2" data-testid="retro-chess-board">
          {ranks.map((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = toSquare(file, rank);
              const piece = chess.get(square);
              const isLight = (fileIndex + rankIndex) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegal = legalTargets.includes(square);
              const isLastMoveFrom = lastMove?.from === square;
              const isLastMoveTo = lastMove?.to === square;
              const isInCheck = chess.isCheck() && piece?.type === 'k' && piece.color === chess.turn();

              const baseClass = isLight
                ? 'bg-[linear-gradient(145deg,#4d88bf,#2f679f)]'
                : 'bg-[linear-gradient(145deg,#102b4f,#0a1f39)]';
              
              // Add pattern overlay to squares
              const patternClass = isLight
                ? 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_50%)] before:pointer-events-none'
                : 'before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_70%_70%,rgba(0,0,0,0.15),transparent_50%)] before:pointer-events-none';
              
              const selectedClass = isSelected ? 'border-cyan-100 ring-2 ring-cyan-200/85' : 'border-cyan-500/30';
              const legalClass = isLegal ? 'before:absolute before:inset-0 before:m-auto before:w-3.5 before:h-3.5 before:bg-cyan-200 before:shadow-[0_0_16px_rgba(165,243,252,0.95)] before:z-10' : '';
              const lastMoveClass = (isLastMoveFrom || isLastMoveTo) ? 'last-move-highlight bg-[rgba(251,191,36,0.25)]' : '';
              const checkClass = isInCheck ? 'animate-check-pulse bg-[rgba(239,68,68,0.35)]' : '';

              return (
                <button
                  key={square}
                  type="button"
                  data-testid={`retro-chess-square-${square}`}
                  aria-label={`Kare ${square}`}
                  onClick={() => handleSquareClick(square)}
                  disabled={loading || submitting || serverStatus === 'finished'}
                  className={`relative aspect-square border transition-all duration-200 ${baseClass} ${patternClass} ${selectedClass} ${legalClass} ${lastMoveClass} ${checkClass} disabled:cursor-not-allowed`}
                >
                  {piece && (
                    <span
                      aria-label={`${piece.color === 'w' ? 'Beyaz' : 'Siyah'} ${PIECE_LABEL[piece.type]}`}
                      className={`pointer-events-none absolute inset-0 flex items-center justify-center select-none transition-transform duration-200 ${piece.color === 'w' ? 'text-white' : 'text-[#1a1a2e]'
                        }`}
                      style={{
                        fontSize: 'clamp(1.4rem, 5.2vw, 2.3rem)',
                        fontFamily: 'serif',
                        lineHeight: 1,
                        filter:
                          piece.color === 'w'
                            ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.8)) drop-shadow(0 0 6px rgba(165,243,252,0.35))'
                            : 'drop-shadow(0 1px 1px rgba(200,230,255,0.6)) drop-shadow(0 0 4px rgba(34,211,238,0.2))',
                        WebkitTextStroke:
                          piece.color === 'w'
                            ? '0.8px rgba(6,18,40,0.9)'
                            : '0.6px rgba(140,200,240,0.55)',
                      }}
                    >
                      {PIECE_SYMBOL[piece.color][piece.type]}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        </div>

        {canUseChessMatchActions && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {!pendingDrawOffer && (
              <RetroButton
                onClick={() => void submitDrawOffer('offer')}
                disabled={submitting}
              >
                Beraberlik Teklif Et
              </RetroButton>
            )}
            {isPendingOfferByActor && (
              <RetroButton
                onClick={() => void submitDrawOffer('cancel')}
                disabled={submitting}
                variant="secondary"
              >
                Teklifi Geri Çek
              </RetroButton>
            )}
            {isPendingOfferByOpponent && (
              <RetroButton
                onClick={() => void submitDrawOffer('accept')}
                disabled={submitting}
              >
                Beraberliği Kabul Et
              </RetroButton>
            )}
            {isPendingOfferByOpponent && (
              <RetroButton
                onClick={() => void submitDrawOffer('reject')}
                disabled={submitting}
                variant="secondary"
              >
                Teklifi Reddet
              </RetroButton>
            )}
            <RetroButton
              onClick={() => void resignAndLeave(false)}
              disabled={submitting}
              variant="danger"
            >
              Teslim Ol
            </RetroButton>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <RetroButton onClick={() => void fetchGameSnapshot()} disabled={loading || submitting || isBot}>
            Senkronu Yenile
          </RetroButton>
          <RetroButton onClick={handleLeave} variant="secondary">
            Lobiye Dön
          </RetroButton>
        </div>

        <div className="mt-5 rf-screen-card-muted p-3 max-h-56 overflow-y-auto custom-scrollbar">
          <h3 className="font-pixel text-sm text-white mb-2 tracking-wide">HAMLE GEÇMİŞİ</h3>
          {moveLog.length === 0 ? (
            <p className="text-xs text-[var(--rf-muted)]">Henüz hamle yapılmadı.</p>
          ) : (
            <ol className="space-y-1 text-xs">
              {moveLog.map((entry, index) => (
                <li key={`${entry.ts}-${index}`} className="flex items-center justify-between gap-2 border-b border-cyan-400/10 pb-1">
                  <span className="text-cyan-200">
                    {index + 1}. {entry.san} ({entry.from}→{entry.to})
                  </span>
                  <span className="text-[var(--rf-muted)]">
                    {Number.isFinite(Number(entry.spentMs)) ? `${Math.round(Number(entry.spentMs) / 1000)} sn` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
