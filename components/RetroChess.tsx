import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move, Square } from 'chess.js';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';
import { ConnectionOverlay } from './ConnectionOverlay';
import { ChessBoardOverlay, type ChessBoardOverlayHandle } from './games/ChessBoardOverlay';
import { ChessPieceIcon, PIECE_LABEL_TR } from './games/ChessPieceIcons';
import {
  FILES,
  RANKS,
  buildClockState,
  deriveDisplayClock,
  deriveOpponentLabel,
  derivePlayerColor,
  extractLastMove,
  formatClock,
  inferResultLabel,
  loadChess,
  normalizeDrawOfferState,
  normalizeWinner,
  parseRetryAfterMs,
  shouldPollSnapshot,
  toSquare,
  type DrawOfferState,
} from '../lib/game-logic/retroChess';

interface RetroChessProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number, stats?: { kind: 'chess'; moveCount: number }) => void;
  onLeave: () => void;
  /** Fires synchronously when the server reports the match as finished, so
   *  the parent can suppress the forfeit-confirm dialog before the delayed
   *  onGameEnd callback sets gameResult. */
  onMatchSettled?: () => void;
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

export const RetroChess: React.FC<RetroChessProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
  onMatchSettled,
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
  const [moveLog, setMoveLog] = useState<
    Array<{
      from: string;
      to: string;
      san: string;
      ts: string;
      spentMs?: number;
      remainingMs?: number;
    }>
  >([]);
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
  const pendingSnapshotRef = useRef(false);
  const pollPauseUntilRef = useRef(0);
  const lastRealtimeAtRef = useRef(0);
  const chessFenRef = useRef<string>(chess.fen());
  /** Actual points transferred by the server after settlement; populated from snapshots.
   * Null until the server has resolved the match. Used so the UI doesn't fabricate a
   * reward number when the real wallet move is different (or zero, e.g. loser had no points). */
  const serverStakeRef = useRef<number | null>(null);

  // PixiJS overlay refs. boardGridRef is observed by the overlay to track
  // square pixel coords; pixiOverlayRef is the imperative handle for
  // capture/check/checkmate effects.
  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const pixiOverlayRef = useRef<ChessBoardOverlayHandle | null>(null);
  /** FEN snapshot from the last render — used to diff-detect captures across
   *  both local and incoming-socket moves through a single state-driven path. */
  const prevFenRef = useRef<string>(chess.fen());
  /** Suppresses the one-shot checkmate burst from firing on every render
   *  once the game is over. */
  const checkmateFiredRef = useRef(false);

  useEffect(() => {
    chessFenRef.current = chess.fen();
  }, [chess]);

  /**
   * Find the king square for a given color. Used to position the PixiJS
   * check pulse + checkmate burst at the king under attack.
   */
  const findKingSquare = useCallback((engine: Chess, color: 'w' | 'b'): string | null => {
    const board = engine.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.type === 'k' && cell.color === color) {
          // chess.js board() returns rank 8 first (index 0). Convert to algebraic.
          const file = 'abcdefgh'[f];
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, []);

  /**
   * Sync chess state → PixiJS overlay. Single effect drives:
   *   - orientation flip when player color resolves
   *   - last-move trail
   *   - check pulse ring (or clear)
   *   - capture burst (diffed via prevFenRef so it fires for remote moves too)
   *   - checkmate finale (one-shot per game)
   */
  useEffect(() => {
    const overlay = pixiOverlayRef.current;
    const nextFen = chess.fen();
    if (!overlay) {
      prevFenRef.current = nextFen;
      return;
    }

    overlay.setLastMove(lastMove?.from || null, lastMove?.to || null);

    // Capture diff: if the previous board had a piece on lastMove.to,
    // this move captured it. (Misses en passant — acceptable for v1.)
    if (lastMove && prevFenRef.current !== nextFen) {
      try {
        const prev = loadChess(prevFenRef.current);
        if (prev.get(lastMove.to)) {
          overlay.playCapture(lastMove.to);
        }
      } catch {
        // ignore — prev fen unparsable, no burst
      }
    }

    // Check ring on the side-to-move king (the one in check)
    if (chess.isCheck() && !chess.isCheckmate()) {
      const kingSquare = findKingSquare(chess, chess.turn());
      overlay.setCheckSquare(kingSquare);
    } else {
      overlay.setCheckSquare(null);
    }

    // Checkmate finale — fires once per game
    if (chess.isCheckmate() && !checkmateFiredRef.current) {
      const kingSquare = findKingSquare(chess, chess.turn());
      if (kingSquare) overlay.playCheckmate(kingSquare);
      checkmateFiredRef.current = true;
    }
    if (!chess.isGameOver()) {
      checkmateFiredRef.current = false;
    }

    prevFenRef.current = nextFen;
  }, [chess, lastMove, findKingSquare]);

  const playerColor = useMemo<'w' | 'b' | null>(
    () =>
      derivePlayerColor({
        isBot,
        currentUsername: currentUser.username,
        hostName,
        guestName,
      }),
    [currentUser.username, guestName, hostName, isBot]
  );

  const orientation = playerColor === 'b' ? 'b' : 'w';
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === 'w' ? [...RANKS] : [...RANKS].reverse();

  // Keep the PixiJS overlay's board orientation in sync. The overlay computes
  // square pixel coords based on this so captures/check land on the right square.
  useEffect(() => {
    pixiOverlayRef.current?.setOrientation(orientation);
  }, [orientation]);

  // Notify the parent (Dashboard) the moment the match is settled server-side,
  // so the forfeit-confirm dialog gets suppressed before the delayed
  // onGameEnd callback (700ms) actually sets gameResult.
  useEffect(() => {
    if (serverStatus === 'finished') {
      onMatchSettled?.();
    }
  }, [serverStatus, onMatchSettled]);
  const turn = chess.turn();
  const effectiveSelectableColor = playerColor || turn;
  const isMyTurn = Boolean(playerColor) && turn === playerColor && serverStatus !== 'finished';
  const opponentLabel = useMemo(
    () =>
      deriveOpponentLabel({
        isBot,
        playerColor,
        guestName,
        hostName,
        opponentName,
      }),
    [guestName, hostName, isBot, opponentName, playerColor]
  );
  const actorKey = String(currentUser.username || '')
    .trim()
    .toLowerCase();
  const pendingDrawOffer = drawOffer && drawOffer.status === 'pending' ? drawOffer : null;
  const isPendingOfferByActor = Boolean(
    pendingDrawOffer && actorKey && pendingDrawOffer.offeredBy.trim().toLowerCase() === actorKey
  );
  const isPendingOfferByOpponent = Boolean(pendingDrawOffer) && !isPendingOfferByActor;
  const canUseChessMatchActions =
    Boolean(gameId) && !isBot && Boolean(playerColor) && serverStatus !== 'finished';

  const clearSelection = () => {
    setSelectedSquare(null);
    setLegalTargets([]);
  };

  const concludeGame = useCallback(
    // knownMoveCount: the server's move log length — a board restored from a FEN
    // has no engine history, so the result card would otherwise report 0 moves.
    (winnerFromState: string | null, engine: Chess, knownMoveCount = 0) => {
      if (concludeRef.current) return;
      concludeRef.current = true;
      const winner = normalizeWinner(winnerFromState);
      const didWin = winner ? winner.toLowerCase() === currentUser.username.toLowerCase() : false;
      // Bot/local matches don't go through server settlement; show a cosmetic reward only.
      // Multiplayer: use the actual `stakeTransferred` set by the backend during settlement.
      const BOT_WIN_REWARD = 12;
      const serverStake = serverStakeRef.current;
      const points = didWin
        ? isBot || serverStake === null
          ? BOT_WIN_REWARD
          : Math.max(0, Math.floor(serverStake))
        : 0;
      const label = winner ? `${winner} kazandı.` : `${inferResultLabel(engine)} ile bitti.`;
      setMessage(label);
      setLiveResultLabel(winner ? 'Kazanan belirlendi' : inferResultLabel(engine));
      if (!isBot && gameId) {
        void api.games.finish(gameId, winner || '').catch((err) => {
          console.error('RetroChess finish sync failed', err);
        });
      }
      const stats = {
        kind: 'chess' as const,
        moveCount: Math.max(engine.history().length, knownMoveCount),
      };
      window.setTimeout(() => onGameEnd(winner || 'Berabere', points, stats), 700);
    },
    [currentUser.username, gameId, isBot, onGameEnd]
  );

  const applyGameSnapshot = useCallback(
    (snapshot: GameSnapshot) => {
      if (snapshot.hostName) setHostName(String(snapshot.hostName));
      if (snapshot.guestName) setGuestName(String(snapshot.guestName));
      if (snapshot.status) setServerStatus(String(snapshot.status));
      const winner = normalizeWinner(snapshot.winner || snapshot.gameState?.chess?.winner);
      if (winner) setServerWinner(winner);
      // Capture the server-resolved stake (set by finishGameHandler after settlement)
      // so concludeGame can show the real reward in the toast instead of a guess.
      const stakeFromSnapshot = (snapshot.gameState as { stakeTransferred?: number } | undefined)
        ?.stakeTransferred;
      if (typeof stakeFromSnapshot === 'number' && Number.isFinite(stakeFromSnapshot)) {
        serverStakeRef.current = stakeFromSnapshot;
      }
      setDrawOffer(normalizeDrawOfferState(snapshot.gameState?.chess?.drawOffer));
      const incomingMoves = Array.isArray(snapshot.gameState?.chess?.moveHistory)
        ? snapshot.gameState?.chess?.moveHistory
        : [];
      setMoveLog(incomingMoves.slice(-200));
      setLastMove(extractLastMove(incomingMoves));

      const normalizedClock = buildClockState(snapshot.gameState?.chess?.clock);
      if (normalizedClock) {
        setClockState(normalizedClock);
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
        concludeGame(winner, nextEngine, incomingMoves.length);
        return;
      }

      const whoseTurn = nextEngine.turn() === 'w' ? 'Beyaz' : 'Siyah';
      setMessage(`Sıra: ${whoseTurn}.`);
    },
    [concludeGame]
  );

  const fetchGameSnapshot = useCallback(
    async (silent = false) => {
      if (!gameId || isBot) return;
      // 🔒 CRITICAL FIX: If another request is in-flight, mark as pending and retry after
      if (requestInFlightRef.current) {
        pendingSnapshotRef.current = true;
        return;
      }
      requestInFlightRef.current = true;
      if (!silent) setLoading(true);
      try {
        const snapshot = (await api.games.get(gameId)) as GameSnapshot;
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
          setMessage(
            err instanceof Error && err.message
              ? err.message
              : 'Oyun durumu alınamadı. Bağlantı yeniden deneniyor...'
          );
        }
      } finally {
        requestInFlightRef.current = false;
        if (!silent) setLoading(false);
        // 🔒 CRITICAL FIX: If a snapshot was requested while we were in-flight, fetch again
        if (pendingSnapshotRef.current) {
          pendingSnapshotRef.current = false;
          window.setTimeout(() => fetchGameSnapshot(silent), 0);
        }
      }
    },
    [applyGameSnapshot, gameId, isBot]
  );

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
      // 🔒 SECURITY: Validate payload structure
      if (payload.type && typeof payload.type !== 'string') return;
      if (payload.chess && typeof payload.chess !== 'object') return;
      lastRealtimeAtRef.current = Date.now();

      if (payload.type === 'draw_offer_updated') {
        const incomingOffer = normalizeDrawOfferState(
          payload.drawOffer || payload.gameState?.chess?.drawOffer || payload.chess?.drawOffer
        );
        setDrawOffer(incomingOffer);
        if (incomingOffer?.status === 'pending') {
          const byActor = actorKey && incomingOffer.offeredBy.trim().toLowerCase() === actorKey;
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
          setLastMove(extractLastMove(payload.chess.moveHistory));
        }
        const normalizedClock = buildClockState(payload.chess.clock);
        if (normalizedClock) {
          setClockState(normalizedClock);
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
          concludeGame(
            winner,
            engine,
            Array.isArray(payload.chess.moveHistory) ? payload.chess.moveHistory.length : 0
          );
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
      if (
        !shouldPollSnapshot({
          isBot,
          hasGameId: Boolean(gameId),
          serverStatus,
          pollPauseUntil: pollPauseUntilRef.current,
          lastRealtimeAt: lastRealtimeAtRef.current,
          visibilityState: document.visibilityState,
        })
      ) {
        return;
      }
      void fetchGameSnapshot(true);
    }, 15000);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchGameSnapshot, gameId, isBot, serverStatus]);

  useEffect(() => {
    const tick = () => {
      setDisplayClock(
        deriveDisplayClock({
          clockState,
          serverStatus,
          turn,
        })
      );
    };

    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [clockState, serverStatus, turn]);

  const runBotMove = useCallback(
    (engineAfterPlayerMove: Chess) => {
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
    },
    [concludeGame, isBot]
  );

  const submitMove = useCallback(
    async (from: Square, to: Square) => {
      if (submitting || serverStatus === 'finished') return;
      const movingPiece = chess.get(from);
      if (!movingPiece) return;
      const promotion =
        movingPiece.type === 'p' && (to.endsWith('8') || to.endsWith('1')) ? 'q' : undefined;
      const targetPiece = chess.get(to);
      const isCapture = Boolean(targetPiece);

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
        // 🎵 Rich sound feedback for bot mode
        if (cloned.isCheckmate()) {
          playGameSfx('success', 0.45);
        } else if (cloned.isCheck()) {
          playGameSfx('fail', 0.3);
        } else if (isCapture) {
          playGameSfx('hit', 0.3);
        } else {
          playGameSfx('select', 0.2);
        }
        if (cloned.isGameOver()) {
          concludeGame(null, cloned);
          return;
        }
        setMessage('Hamlen kabul edildi. BOT düşünüyor...');
        runBotMove(sandbox);
        return;
      }

      // Multiplayer mode
      setSubmitting(true);
      try {
        const result = (await api.games.move(gameId, {
          chessMove: { from, to, ...(promotion ? { promotion } : {}) },
        })) as {
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
        const normalizedClock = buildClockState(result?.gameState?.chess?.clock);
        if (normalizedClock) {
          setClockState(normalizedClock);
        }
        clearSelection();
        if (result?.status) setServerStatus(result.status);
        const winner = normalizeWinner(result?.winner || result?.gameState?.chess?.winner);
        if (winner) setServerWinner(winner);

        // 🎵 Rich sound feedback for multiplayer
        if (engine.isCheckmate()) {
          playGameSfx('success', 0.45);
        } else if (engine.isCheck()) {
          playGameSfx('fail', 0.3);
        } else if (isCapture) {
          playGameSfx('hit', 0.3);
        } else {
          playGameSfx('select', 0.2);
        }

        if (
          result?.gameState?.chess?.isGameOver ||
          result?.status === 'finished' ||
          engine.isGameOver()
        ) {
          concludeGame(
            winner,
            engine,
            Array.isArray(result?.gameState?.chess?.moveHistory)
              ? result.gameState.chess.moveHistory.length
              : 0
          );
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
    },
    [chess, concludeGame, fetchGameSnapshot, gameId, isBot, runBotMove, serverStatus, submitting]
  );

  const submitDrawOffer = useCallback(
    async (action: 'offer' | 'accept' | 'reject' | 'cancel') => {
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
        setMessage(
          err instanceof Error && err.message ? err.message : 'Beraberlik işlemi yapılamadı.'
        );
        void fetchGameSnapshot(true);
      } finally {
        setSubmitting(false);
      }
    },
    [canUseChessMatchActions, fetchGameSnapshot, gameId, submitting]
  );

  const resignAndLeave = useCallback(
    async (leaveAfterResign = false) => {
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
        setMessage(
          err instanceof Error && err.message ? err.message : 'Teslim olma işlemi başarısız.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [fetchGameSnapshot, gameId, isBot, onLeave, playerColor, serverStatus, submitting]
  );

  const handleLeave = useCallback(() => {
    if (canUseChessMatchActions) {
      void resignAndLeave(true);
      return;
    }
    onLeave();
  }, [canUseChessMatchActions, onLeave, resignAndLeave]);

  const handleSquareClick = (square: Square) => {
    if (submitting || serverStatus === 'finished') return;
    // Block clicks when it's not the user's turn — including the brief
    // window before the snapshot resolves playerColor. Previously a
    // playerColor=null guard let the click fall through to
    // effectiveSelectableColor=turn, so the user could pick the wrong-side
    // piece and the server would 409 silently.
    if (!isBot && !isMyTurn) {
      setMessage(playerColor ? 'Sıra rakipte.' : 'Oyun yükleniyor…');
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

    const legal = chess.moves({ square, verbose: true }).map((mv) => mv.to as Square);
    if (legal.length === 0) {
      clearSelection();
      return;
    }
    setSelectedSquare(square);
    setLegalTargets(legal);
  };

  const turnLabel = turn === 'w' ? 'Beyaz' : 'Siyah';
  // A board restored from a FEN has no engine history; the server's move log does.
  const moveCount = Math.max(chess.history().length, moveLog.length);
  const statusLabel = serverStatus === 'finished' ? 'Bitti' : 'Aktif';
  const clockRunning = serverStatus !== 'finished';

  const renderClock = (side: 'w' | 'b') => {
    const active = clockRunning && turn === side;
    const label = side === 'w' ? 'Beyaz' : 'Siyah';
    return (
      <div className={`duo-stat ${active ? 'duo-stat--ink' : ''}`}>
        <span className="duo-stat-label">
          {label}
          {playerColor === side ? ' · sen' : ''}
        </span>
        <span className="duo-stat-value duo-stat-value--score">
          {formatClock(side === 'w' ? displayClock.white : displayClock.black)}
        </span>
      </div>
    );
  };

  return (
    <>
      <ConnectionOverlay gameId={gameId} />
      <div className="max-w-6xl mx-auto text-carbon" data-testid="retro-chess">
        <header className="duo-game-head mb-6">
          <div className="min-w-0">
            <span className="duo-game-chip bg-candy-gok">Klasik · {clockState.label}</span>
            <h2 className="duo-game-title">Retro Satranç</h2>
            <p className="duo-game-sub truncate">Rakip: {opponentLabel}</p>
          </div>
          <button type="button" onClick={handleLeave} className="duo-quiet duo-focus shrink-0">
            <span className="duo-sentence">Oyundan Çık</span>
          </button>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-x-10">
          <div className="grid grid-cols-2 gap-2 lg:col-span-5 lg:col-start-8 lg:row-start-1">
            {renderClock(orientation === 'w' ? 'b' : 'w')}
            {renderClock(orientation)}
          </div>

          <div className="w-full max-w-[620px] mx-auto lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mx-0">
            <div
              ref={boardGridRef}
              className="relative grid grid-cols-8 gap-0"
              data-testid="retro-chess-board"
            >
              {/* PixiJS overlay — absolutely positioned, fills the grid, captures/check effects */}
              <ChessBoardOverlay
                ref={pixiOverlayRef}
                boardRef={boardGridRef}
                className="pointer-events-none absolute inset-0 z-20 h-full w-full"
              />
              {ranks.map((rank, rankIndex) =>
                files.map((file, fileIndex) => {
                  const square = toSquare(file, rank);
                  const piece = chess.get(square);
                  const isLight = (fileIndex + rankIndex) % 2 === 0;
                  const isSelected = selectedSquare === square;
                  const isLegal = legalTargets.includes(square);
                  const isLastMoveFrom = lastMove?.from === square;
                  const isLastMoveTo = lastMove?.to === square;
                  const isInCheck =
                    chess.isCheck() && piece?.type === 'k' && piece.color === chess.turn();

                  // DESIGN.md board: light squares board-light, dark squares board-dark,
                  // the last move tinted limon, the selection ringed in lokum.
                  const baseClass =
                    isLastMoveFrom || isLastMoveTo
                      ? 'bg-candy-limon'
                      : isLight
                        ? 'bg-[#F2F9FB]'
                        : 'bg-[#7FC9EE]';
                  const selectedClass = isSelected ? 'ring-4 ring-inset ring-candy-lokum z-10' : '';
                  const legalClass = isLegal
                    ? piece
                      ? 'ring-4 ring-inset ring-candy-lokum/70'
                      : 'before:absolute before:inset-0 before:m-auto before:w-3 before:h-3 before:bg-candy-lokum before:z-10'
                    : '';
                  const checkClass = isInCheck ? 'animate-check-pulse !bg-candy-danger/40' : '';

                  return (
                    <button
                      key={square}
                      type="button"
                      data-testid={`retro-chess-square-${square}`}
                      aria-label={`Kare ${square}`}
                      onClick={() => handleSquareClick(square)}
                      disabled={loading || submitting || serverStatus === 'finished'}
                      className={`duo-focus relative aspect-square transition-colors duration-200 ease-out ${baseClass} ${selectedClass} ${legalClass} ${checkClass} disabled:cursor-not-allowed`}
                    >
                      {piece && (
                        <span
                          aria-label={`${piece.color === 'w' ? 'Beyaz' : 'Siyah'} ${PIECE_LABEL_TR[piece.type]}`}
                          className={`pointer-events-none absolute inset-0 flex items-center justify-center select-none transition-transform duration-200 ease-out ${
                            isSelected ? 'scale-110' : 'scale-100'
                          }`}
                        >
                          <ChessPieceIcon
                            type={piece.type}
                            color={piece.color}
                            size={36}
                            className="w-[78%] h-[78%]"
                          />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-w-0 self-start lg:col-span-5 lg:col-start-8 lg:row-start-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="duo-stat">
                <span className="duo-stat-label">Durum</span>
                <span className="duo-stat-value">{statusLabel}</span>
              </div>
              <div
                className={`duo-stat ${isMyTurn ? 'duo-stat--gok' : ''}`}
                data-testid="retro-chess-turn-tile"
              >
                <span className="duo-stat-label">
                  {playerColor ? `Sen: ${playerColor === 'w' ? 'Beyaz' : 'Siyah'}` : 'Sıra'}
                </span>
                <span className="duo-stat-value">
                  {playerColor ? (isMyTurn ? 'Sıra sende' : 'Sıra rakipte') : turnLabel}
                </span>
              </div>
              <div className="duo-stat">
                <span className="duo-stat-label">Hamle</span>
                <span className="duo-stat-value">{moveCount}</span>
              </div>
              <div className="duo-stat">
                <span className="duo-stat-label">Tempo</span>
                <span className="duo-stat-value">{clockState.label}</span>
              </div>
            </div>

            <div className="mt-5 space-y-1" aria-live="polite">
              <p className="duo-game-status">{message}</p>
              {liveResultLabel && <p className="text-sm text-carbon-muted">{liveResultLabel}</p>}
              {serverWinner && (
                <p className="text-sm font-semibold text-carbon">Kazanan: {serverWinner}</p>
              )}
              {pendingDrawOffer && (
                <p className="text-sm text-carbon-muted">
                  {isPendingOfferByActor
                    ? 'Gönderdiğin beraberlik teklifi için rakip yanıtı bekleniyor.'
                    : `${pendingDrawOffer.offeredBy} beraberlik teklifi gönderdi.`}
                </p>
              )}
            </div>

            {canUseChessMatchActions && (
              <div className="duo-game-actions mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {!pendingDrawOffer && (
                  <RetroButton onClick={() => void submitDrawOffer('offer')} disabled={submitting}>
                    Beraberlik teklif et
                  </RetroButton>
                )}
                {isPendingOfferByActor && (
                  <RetroButton
                    onClick={() => void submitDrawOffer('cancel')}
                    disabled={submitting}
                    variant="secondary"
                  >
                    Teklifi geri çek
                  </RetroButton>
                )}
                {isPendingOfferByOpponent && (
                  <RetroButton onClick={() => void submitDrawOffer('accept')} disabled={submitting}>
                    Beraberliği kabul et
                  </RetroButton>
                )}
                {isPendingOfferByOpponent && (
                  <RetroButton
                    onClick={() => void submitDrawOffer('reject')}
                    disabled={submitting}
                    variant="secondary"
                  >
                    Teklifi reddet
                  </RetroButton>
                )}
                <RetroButton
                  onClick={() => void resignAndLeave(false)}
                  disabled={submitting}
                  variant="danger"
                >
                  Teslim ol
                </RetroButton>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
              <button
                type="button"
                onClick={() => void fetchGameSnapshot()}
                disabled={loading || submitting || isBot}
                className="duo-quiet duo-focus"
              >
                Senkronu yenile
              </button>
            </div>

            <section className="duo-tear mt-6 pt-4" aria-label="Hamle geçmişi">
              <h3 className="text-[15px] font-semibold text-carbon">Hamle geçmişi</h3>
              {moveLog.length === 0 ? (
                <p className="mt-2 text-sm text-carbon-muted">Henüz hamle yapılmadı.</p>
              ) : (
                <ol className="mt-1 max-h-64 overflow-y-auto custom-scrollbar pr-1 text-sm font-candy-mono">
                  {moveLog.map((entry, index) => (
                    <li key={`${entry.ts}-${index}`} className="duo-leader-row">
                      <span className="text-carbon">
                        {index + 1}. {entry.san}{' '}
                        <span className="text-carbon-muted">
                          ({entry.from}→{entry.to})
                        </span>
                      </span>
                      <span className="duo-leader-dots" aria-hidden="true" />
                      <span className="duo-leader-value text-carbon">
                        {Number.isFinite(Number(entry.spentMs))
                          ? `${Math.round(Number(entry.spentMs) / 1000)} sn`
                          : '–'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};
