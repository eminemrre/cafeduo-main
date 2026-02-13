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
}

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
    const incomingMoves = Array.isArray(snapshot.gameState?.chess?.moveHistory)
      ? snapshot.gameState?.chess?.moveHistory
      : [];
    setMoveLog(incomingMoves.slice(-200));

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

      if (payload.type === 'game_joined') {
        setMessage('Rakip oyuna bağlandı. Satranç başladı.');
        void fetchGameSnapshot(true);
        return;
      }

      if (payload.type === 'game_finished') {
        setServerStatus('finished');
        setServerWinner(normalizeWinner(payload.winner));
        void fetchGameSnapshot(true);
        return;
      }

      if (payload.chess?.fen) {
        if (Array.isArray(payload.chess.moveHistory)) {
          setMoveLog(payload.chess.moveHistory.slice(-200));
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
  }, [concludeGame, fetchGameSnapshot, gameId, isBot]);

  useEffect(() => {
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

    if (isBot || !gameId) {
      const sandbox = loadChess(chess.fen());
      const applied = sandbox.move({ from, to, ...(promotion ? { promotion } : {}) });
      if (!applied) {
        playGameSfx('fail', 0.25);
        setMessage('Yasadışı hamle.');
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
      className="max-w-4xl mx-auto rf-panel border-cyan-400/22 rounded-xl p-4 sm:p-6 text-white relative overflow-hidden"
      data-testid="retro-chess"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(3, 16, 40, 0.94), rgba(4, 28, 56, 0.9)), url('${GAME_ASSETS.backgrounds.strategyChess}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-50" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Retro Satranç (Klasik)</h2>
        <button onClick={onLeave} className="text-[var(--rf-muted)] hover:text-white text-sm">
          Oyundan Çık
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Durum</div>
          <div className="font-bold">{statusLabel}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Sıra</div>
          <div className="font-bold">{turnLabel}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Tempo</div>
          <div className="font-bold">{clockState.label}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Rakip</div>
          <div className="font-bold truncate">{opponentLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Beyaz Süre</div>
          <div className="font-bold text-cyan-100">{formatClock(displayClock.white)}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Hamle</div>
          <div className="font-bold">{moveCount}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Siyah Süre</div>
          <div className="font-bold text-cyan-100">{formatClock(displayClock.black)}</div>
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-1">{message}</p>
      {liveResultLabel && (
        <p className="text-xs text-cyan-200 mb-3">{liveResultLabel}</p>
      )}
      {serverWinner && (
        <p className="text-xs text-emerald-300 mb-3">Kazanan: {serverWinner}</p>
      )}

      <div className="w-full max-w-[620px] mx-auto rounded-2xl border border-cyan-300/22 p-2 sm:p-3 bg-[#06132b]/85 shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2" data-testid="retro-chess-board">
          {ranks.map((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = toSquare(file, rank);
              const piece = chess.get(square);
              const isLight = (fileIndex + rankIndex) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegal = legalTargets.includes(square);

              const baseClass = isLight
                ? 'bg-[linear-gradient(145deg,#4d88bf,#2f679f)]'
                : 'bg-[linear-gradient(145deg,#102b4f,#0a1f39)]';
              const selectedClass = isSelected ? 'border-cyan-100 ring-2 ring-cyan-200/85' : 'border-cyan-500/30';
              const legalClass = isLegal ? 'before:absolute before:inset-0 before:m-auto before:w-3.5 before:h-3.5 before:rounded-full before:bg-cyan-200 before:shadow-[0_0_16px_rgba(165,243,252,0.95)]' : '';

              return (
                <button
                  key={square}
                  type="button"
                  data-testid={`retro-chess-square-${square}`}
                  aria-label={`Kare ${square}`}
                  onClick={() => handleSquareClick(square)}
                  disabled={loading || submitting || serverStatus === 'finished'}
                  className={`relative aspect-square rounded border transition ${baseClass} ${selectedClass} ${legalClass} disabled:cursor-not-allowed`}
                >
                  {piece && (
                    <span
                      aria-label={`${piece.color === 'w' ? 'Beyaz' : 'Siyah'} ${PIECE_LABEL[piece.type]}`}
                      className={`pointer-events-none absolute inset-0 flex items-center justify-center select-none ${
                        piece.color === 'w' ? 'text-slate-50' : 'text-[#071327]'
                      }`}
                      style={{
                        fontSize: 'clamp(1.2rem, 4.7vw, 2.05rem)',
                        fontFamily: '"Noto Sans", "Exo 2", sans-serif',
                        lineHeight: 1,
                        textShadow:
                          piece.color === 'w'
                            ? '0 1px 0 rgba(4,19,42,0.95), 0 0 16px rgba(165,243,252,0.45)'
                            : '0 1px 0 rgba(225,246,255,0.45), 0 0 12px rgba(34,211,238,0.22)',
                        WebkitTextStroke:
                          piece.color === 'w'
                            ? '0.7px rgba(6,18,40,0.95)'
                            : '0.85px rgba(170,230,255,0.72)',
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

      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        <RetroButton onClick={() => void fetchGameSnapshot()} disabled={loading || submitting || isBot}>
          Senkronu Yenile
        </RetroButton>
        <RetroButton onClick={onLeave} variant="secondary">
          Lobiye Dön
        </RetroButton>
      </div>

      <div className="mt-5 rf-panel border border-cyan-400/20 rounded-lg p-3 max-h-56 overflow-y-auto">
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
  );
};
