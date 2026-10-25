import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User, CompetitiveEngineState, CompetitiveGame } from '../types';
import { api } from '../lib/api';
import {
  actorKeyFor,
  createActionId,
  engineOf,
  isCompetitiveGameType,
  isProtocolV2,
  secondsLeftAt,
  serverClockOffset,
  type ActorKey,
} from '../lib/competitiveGame';
import { socketService } from '../lib/socket';

/**
 * Server-authoritative lifecycle for the two ranked multiplayer games.
 *
 * The client never computes a score, a winner or a deadline. It sends an
 * `actionId` + `roundId` envelope, applies the returned public snapshot and
 * ignores stale revisions. Reconnects refetch the snapshot; a 15 s fallback
 * poll only fills gaps when Socket.IO is unavailable.
 */

export interface LiveMatchStats {
  kind: 'quiz' | 'arena' | 'battleship' | 'hangman' | 'draw';
  playerScore: number;
  opponentScore: number;
  durationMs: number;
  maxRounds?: number;
  correctAnswers?: number;
}

export type LiveActionType =
  | 'answer'
  | 'joker'
  | 'fire'
  | 'place'
  | 'guess'
  | 'solve'
  | 'pick'
  | 'report'
  | 'resign';

export interface LiveActionInput {
  type: LiveActionType;
  optionIndex?: number;
  /** Aim fire only: estimated server time (epoch ms) the reticle was drawn. */
  shotAt?: number;
  /** Amiral Battı target cell (0-63). */
  cell?: number;
  /** Amiral Battı fleet layout, in fleet order. */
  layout?: { cell: number; dir: 'h' | 'v' }[];
  auto?: true;
  /** Adam Asmaca: one letter (`guess`) or the whole word (`solve`). */
  letter?: string;
  word?: string;
}

export interface LiveActionResult {
  ok: boolean;
  code?: string;
  message?: string;
  duplicate?: boolean;
}

export interface UseLiveScoreGameOptions {
  currentUser: User;
  gameId: string | number | null;
  isBot: boolean;
  /** Game type sent to the server (e.g. 'Nişancı Düellosu', 'Bilgi Yarışı'). */
  mode: string;
  /** Kept for callers that still pass it; the v2 action id replaces it. */
  submissionKeyPrefix?: string;
  /** Fallback polling interval; never below 15 s for competitive games. */
  pollIntervalMs?: number;
  logName?: string;
  statsKind: 'quiz' | 'arena' | 'battleship' | 'hangman' | 'draw';
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
}

export interface UseLiveScoreGameResult {
  snapshot: CompetitiveGame | null;
  engine: CompetitiveEngineState | null;
  actorKey: ActorKey | null;
  player: CompetitiveEngineState['players']['host'] | null;
  opponent: CompetitiveEngineState['players']['guest'] | null;
  playerScore: number;
  opponentScore: number;
  hostName: string;
  guestName: string;
  done: boolean;
  pending: boolean;
  pendingType: LiveActionType | null;
  resolvingMatch: boolean;
  error: string | null;
  protocolError: boolean;
  secondsLeft: number;
  fetchSnapshot: (silent?: boolean) => Promise<CompetitiveGame | null>;
  submitAction: (input: LiveActionInput) => Promise<LiveActionResult>;
  resign: () => Promise<LiveActionResult>;
  serverNow: () => number;
  reset: () => void;
}

const normalizeName = (value: unknown) => String(value || '').trim();
const FINISH_DELAY_MS = 650;
const PROTOCOL_ERROR_MESSAGE =
  'Oyun istemcisi güncel değil. Sayfayı yenileyip maça tekrar gir; eski oyun protokolüne geçiş yapılmaz.';

type ActionRetry = {
  key: string;
  payload: {
    actionId: string;
    roundId: string;
    type: LiveActionType;
    optionIndex?: number;
    cell?: number;
    layout?: { cell: number; dir: 'h' | 'v' }[];
    auto?: true;
  };
};

export function useLiveScoreGame(options: UseLiveScoreGameOptions): UseLiveScoreGameResult {
  const {
    currentUser,
    gameId,
    isBot,
    pollIntervalMs = 15_000,
    logName = 'LiveScoreGame',
    statsKind,
    onGameEnd,
  } = options;

  const [snapshot, setSnapshot] = useState<CompetitiveGame | null>(null);
  const [engine, setEngine] = useState<CompetitiveEngineState | null>(null);
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingType, setPendingType] = useState<LiveActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [protocolError, setProtocolError] = useState(false);
  const [, setClockTick] = useState(0);

  const mountedRef = useRef(true);
  const engineRef = useRef<CompetitiveEngineState | null>(null);
  const snapshotRef = useRef<CompetitiveGame | null>(null);
  const clockOffsetRef = useRef(0);
  const finishHandledRef = useRef(false);
  const protocolErrorRef = useRef(false);
  const pendingRef = useRef(false);
  const retryRef = useRef<ActionRetry | null>(null);
  const pollRef = useRef<number | null>(null);
  const phaseTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const fetchInFlightRef = useRef(false);
  /** A refetch asked for during another one runs right after it, never dropped. */
  const refetchQueuedRef = useRef(false);
  const gameIdRef = useRef(gameId);
  const onGameEndRef = useRef(onGameEnd);

  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
  }, [onGameEnd]);

  const buildStats = useCallback(
    (source?: CompetitiveEngineState | null): LiveMatchStats => {
      const current = source || engineRef.current;
      const actorKey = actorKeyFor(snapshotRef.current, currentUser.username);
      const fallbackKey: ActorKey = actorKey || 'host';
      const otherKey: ActorKey = fallbackKey === 'host' ? 'guest' : 'host';
      const resultScores = current?.result?.scores;
      const playerScore = Number(
        resultScores?.[fallbackKey] ?? current?.players?.[fallbackKey]?.score ?? 0
      );
      const opponentScore = Number(
        resultScores?.[otherKey] ?? current?.players?.[otherKey]?.score ?? 0
      );
      const startedAt = Date.parse(String(current?.startedAt || ''));
      return {
        kind: statsKind,
        playerScore: Math.max(0, playerScore),
        opponentScore: Math.max(0, opponentScore),
        durationMs: Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0,
        ...(typeof current?.totalRounds === 'number' ? { maxRounds: current.totalRounds } : {}),
        ...(typeof current?.players?.[fallbackKey]?.correct === 'number'
          ? { correctAnswers: current.players[fallbackKey].correct }
          : {}),
      };
    },
    [currentUser.username, statsKind]
  );

  const finishFromServer = useCallback(
    (nextEngine: CompetitiveEngineState) => {
      if (finishHandledRef.current) return;
      const result = nextEngine.result;
      if (!result) return;
      finishHandledRef.current = true;
      if (finishTimerRef.current) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }

      const cancelled = Boolean(result.cancelled);
      const draw = Boolean(result.draw) || (!result.winner && !cancelled);
      const winner = cancelled
        ? 'Maç iptal edildi'
        : draw || !result.winner
          ? 'Berabere'
          : String(result.winner);
      const isWinner =
        !cancelled &&
        !draw &&
        normalizeName(winner).toLowerCase() === normalizeName(currentUser.username).toLowerCase();
      const transferred = Math.max(
        0,
        Math.floor(Number(result.stakeTransferred ?? result.transferredPoints ?? 0) || 0)
      );
      const stats = buildStats(nextEngine);

      setDone(true);
      finishTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        onGameEndRef.current(winner, isWinner ? transferred : 0, stats);
      }, FINISH_DELAY_MS);
    },
    [buildStats, currentUser.username]
  );

  const applySnapshot = useCallback(
    (next: CompetitiveGame, receivedAt = Date.now(), sentAt?: number) => {
      if (isBot) return;

      const nextEngine = engineOf(next);
      if (!nextEngine) {
        // A waiting lobby has no engine yet. An active rank game without one is
        // an old cached row/protocol and must never fall back to local scoring.
        if (String(next.status || '').toLowerCase() !== 'waiting') {
          protocolErrorRef.current = true;
          setProtocolError(true);
          setError(PROTOCOL_ERROR_MESSAGE);
        }
        return;
      }
      if (!isCompetitiveGameType(next.gameType) || !isProtocolV2(next)) {
        protocolErrorRef.current = true;
        setProtocolError(true);
        setError(PROTOCOL_ERROR_MESSAGE);
        return;
      }

      const current = engineRef.current;
      if (
        current &&
        Number(nextEngine.revision) < Number(current.revision) &&
        next.status !== 'finished'
      ) {
        // A delayed socket event or poll response. Never roll the UI back.
        return;
      }

      // Unsolicited socket arrivals have no measured round trip. Never let
      // their downstream delay undo the calibrated HTTP clock estimate.
      if (sentAt !== undefined)
        clockOffsetRef.current = serverClockOffset(next, receivedAt, sentAt);
      engineRef.current = nextEngine;
      snapshotRef.current = next;
      setSnapshot(next);
      setEngine(nextEngine);
      setHostName(normalizeName(next.hostName));
      setGuestName(normalizeName(next.guestName));
      setError(null);
      setClockTick((value) => value + 1);

      if (String(next.status || '').toLowerCase() === 'finished') {
        finishFromServer(nextEngine);
      }
    },
    [finishFromServer, isBot]
  );

  const fetchSnapshot = useCallback(
    async (silent = false): Promise<CompetitiveGame | null> => {
      if (isBot || !gameId || protocolErrorRef.current) return null;
      if (fetchInFlightRef.current) {
        refetchQueuedRef.current = true;
        return null;
      }
      fetchInFlightRef.current = true;
      const requestedGameId = String(gameId);
      const sentAt = Date.now();
      try {
        const next = (await api.games.get(gameId)) as CompetitiveGame;
        if (!mountedRef.current || String(gameIdRef.current) !== requestedGameId) return null;
        applySnapshot(next, Date.now(), sentAt);
        return next;
      } catch (err) {
        if (!silent) {
          console.error(`${logName} snapshot error`, err);
          if (mountedRef.current) {
            setError('Oyun durumu alınamadı. Bağlantını kontrol edip tekrar dene.');
          }
        }
        return null;
      } finally {
        fetchInFlightRef.current = false;
        if (refetchQueuedRef.current && mountedRef.current) {
          refetchQueuedRef.current = false;
          void fetchSnapshot(true);
        }
      }
    },
    [applySnapshot, gameId, isBot, logName]
  );

  const submitAction = useCallback(
    async (input: LiveActionInput): Promise<LiveActionResult> => {
      if (isBot || !gameId) return { ok: false, code: 'NOT_MULTIPLAYER' };
      if (pendingRef.current) return { ok: false, code: 'BUSY' };
      if (protocolErrorRef.current) {
        return { ok: false, code: 'CLIENT_UPDATE_REQUIRED', message: PROTOCOL_ERROR_MESSAGE };
      }

      const currentEngine = engineRef.current;
      const roundId = currentEngine?.round?.id;
      if (!roundId) {
        return { ok: false, code: 'NO_ROUND', message: 'Tur henüz hazır değil.' };
      }

      const actionKey = [
        roundId,
        input.type,
        input.optionIndex ?? '',
        input.cell ?? '',
        input.layout ? JSON.stringify(input.layout) : '',
        input.auto ? 'auto' : '',
        input.letter ?? '',
        input.word ?? '',
      ].join('|');
      const previous = retryRef.current;
      const payload =
        previous && previous.key === actionKey
          ? previous.payload
          : {
              actionId: createActionId(input.type),
              roundId,
              type: input.type,
              ...(input.optionIndex !== undefined ? { optionIndex: input.optionIndex } : {}),
              ...(input.cell !== undefined ? { cell: input.cell } : {}),
              ...(input.layout ? { layout: input.layout } : {}),
              ...(input.auto ? { auto: true as const } : {}),
              ...(input.type === 'guess' && input.letter ? { letter: input.letter } : {}),
              ...(input.type === 'solve' && input.word ? { word: input.word } : {}),
              // A retry reuses this payload, so the first shot time is kept.
              ...(input.type === 'fire' && input.shotAt !== undefined
                ? { shotAt: input.shotAt }
                : {}),
            };
      retryRef.current = { key: actionKey, payload };

      pendingRef.current = true;
      setPending(true);
      setPendingType(input.type);
      setError(null);

      const requestedGameId = String(gameId);
      const sentAt = Date.now();
      try {
        const response = await api.games.action(gameId, payload);
        if (!mountedRef.current || String(gameIdRef.current) !== requestedGameId) {
          return { ok: false, code: 'GAME_CHANGED' };
        }
        retryRef.current = null;
        if (response?.game) {
          applySnapshot(response.game as CompetitiveGame, Date.now(), sentAt);
        } else {
          await fetchSnapshot(true);
        }
        return { ok: true, duplicate: Boolean(response?.duplicate) };
      } catch (err) {
        const apiError = err as { code?: string; status?: number; message?: string } | null;
        const code = typeof apiError?.code === 'string' ? apiError.code : undefined;
        const status = typeof apiError?.status === 'number' ? apiError.status : undefined;
        const message =
          typeof apiError?.message === 'string' && apiError.message
            ? apiError.message
            : 'Hamle gönderilemedi. Tekrar dene.';

        // A 4xx answer is definitive (stale round, already answered, conflict).
        // A network error or 5xx may have committed, so keep the same actionId
        // and let the retry return the stored receipt.
        if (status && status >= 400 && status < 500) {
          retryRef.current = null;
          if (code === 'LEGACY_PROTOCOL_DISABLED' || code === 'CLIENT_UPDATE_REQUIRED') {
            protocolErrorRef.current = true;
            setProtocolError(true);
            setError(PROTOCOL_ERROR_MESSAGE);
          } else {
            setError(message);
          }
          void fetchSnapshot(true);
          return { ok: false, code, message };
        }

        if (mountedRef.current) {
          setError('Hamle sunucuya ulaşmadı. Aynı hamleyi tekrar deneyebilirsin.');
        }
        return { ok: false, code: 'NETWORK', message: 'Hamle sunucuya ulaşmadı.' };
      } finally {
        pendingRef.current = false;
        setPending(false);
        setPendingType(null);
      }
    },
    [applySnapshot, fetchSnapshot, gameId, isBot]
  );

  const resign = useCallback(async (): Promise<LiveActionResult> => {
    if (!engineRef.current?.round?.id) {
      return { ok: false, code: 'NO_ROUND', message: 'Tur henüz hazır değil.' };
    }
    return submitAction({ type: 'resign' });
  }, [submitAction]);

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const reset = useCallback(() => {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (phaseTimerRef.current) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    engineRef.current = null;
    snapshotRef.current = null;
    clockOffsetRef.current = 0;
    finishHandledRef.current = false;
    protocolErrorRef.current = false;
    pendingRef.current = false;
    retryRef.current = null;
    setSnapshot(null);
    setEngine(null);
    setHostName('');
    setGuestName('');
    setDone(false);
    setPending(false);
    setPendingType(null);
    setError(null);
    setProtocolError(false);
  }, []);

  // A new game starts from a clean snapshot; nothing local carries into it.
  useEffect(() => {
    reset();
  }, [gameId, isBot, reset]);

  // Socket.IO first, polling as a deliberate 15 s safety net.
  useEffect(() => {
    if (isBot || !gameId) return undefined;
    const room = String(gameId);
    const socket = socketService.getSocket();

    const joinAndRefresh = () => {
      socketService.joinGame(room);
      void fetchSnapshot(true);
    };

    const onRealtime = (payload: {
      gameId?: string | number;
      status?: string;
      gameState?: { engine?: CompetitiveEngineState };
      serverNow?: string;
    }) => {
      if (String(payload?.gameId || '') !== room) return;
      const base = snapshotRef.current;
      const incoming = payload?.gameState?.engine;
      if (base && incoming && Number(incoming.version) === 2) {
        applySnapshot(
          {
            ...base,
            status: (payload.status as CompetitiveGame['status']) || base.status,
            gameState: { engine: incoming },
            serverNow: payload.serverNow || new Date().toISOString(),
          },
          Date.now()
        );
        const actorKey = actorKeyFor(base, currentUser.username);
        if (
          incoming.kind === 'battleship' &&
          actorKey &&
          incoming.players?.[actorKey]?.placed &&
          !base.actorView?.fleet?.length
        ) {
          void fetchSnapshot(true);
        }
        // Çiz Bil: the drawer's choices and word come only with the authenticated
        // GET, so a new round or phase needs a refetch (a guess does not).
        const before = base.gameState?.engine;
        if (
          incoming.kind === 'draw' &&
          (before?.phase !== incoming.phase || before?.round?.id !== incoming.round?.id)
        ) {
          void fetchSnapshot(true);
        }
        // Adam Asmaca: the actor's board belongs to one round; a new round needs
        // the fresh (empty) board, which only the authenticated GET carries.
        if (
          incoming.kind === 'hangman' &&
          incoming.round?.id &&
          base.actorView?.hangman?.roundId !== incoming.round.id
        ) {
          void fetchSnapshot(true);
        }
        return;
      }
      void fetchSnapshot(true);
    };

    joinAndRefresh();
    socket.on('connect', joinAndRefresh);
    socket.on('game_state_updated', onRealtime);
    socket.on('game_finished', onRealtime);
    socket.on('game_joined', onRealtime);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchSnapshot(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    pollRef.current = window.setInterval(
      () => {
        if (document.visibilityState === 'hidden' || finishHandledRef.current) return;
        void fetchSnapshot(true);
      },
      Math.max(15_000, pollIntervalMs)
    );

    return () => {
      socket.off('connect', joinAndRefresh);
      socket.off('game_state_updated', onRealtime);
      socket.off('game_finished', onRealtime);
      socket.off('game_joined', onRealtime);
      document.removeEventListener('visibilitychange', onVisibility);
      socketService.leaveGame(room);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [applySnapshot, currentUser.username, fetchSnapshot, gameId, isBot, pollIntervalMs]);

  // Refresh just after a server deadline: this only asks the server to advance
  // its clock, it never submits a score or picks a winner.
  useEffect(() => {
    if (isBot || !engine?.phaseEndsAt || done) return undefined;
    if (phaseTimerRef.current) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    const endsAt = Date.parse(engine.phaseEndsAt);
    if (!Number.isFinite(endsAt)) return undefined;
    const delay = Math.max(80, Math.min(20_000, endsAt - serverNow() + 220));
    phaseTimerRef.current = window.setTimeout(() => {
      void fetchSnapshot(true);
    }, delay);
    return () => {
      if (phaseTimerRef.current) {
        window.clearTimeout(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    };
  }, [done, engine?.phaseEndsAt, engine?.revision, fetchSnapshot, isBot, serverNow]);

  // Local heartbeat for the countdown/reticle. The server snapshot still owns
  // the actual deadline and position.
  useEffect(() => {
    if (isBot || done) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setClockTick((value) => value + 1);
    }, 250);
    return () => window.clearInterval(interval);
  }, [done, isBot]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (phaseTimerRef.current) window.clearTimeout(phaseTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, []);

  const actorKey = useMemo(
    () => actorKeyFor(snapshot, currentUser.username),
    [currentUser.username, snapshot]
  );
  const player = actorKey ? engine?.players?.[actorKey] || null : null;
  const opponent = actorKey
    ? engine?.players?.[actorKey === 'host' ? 'guest' : 'host'] || null
    : null;
  const secondsLeft = engine?.phaseEndsAt ? secondsLeftAt(engine.phaseEndsAt, serverNow()) : 0;

  return {
    snapshot,
    engine,
    actorKey,
    player,
    opponent,
    playerScore: Math.max(0, Number(player?.score) || 0),
    opponentScore: Math.max(0, Number(opponent?.score) || 0),
    hostName,
    guestName,
    done,
    pending,
    pendingType,
    resolvingMatch: pending,
    error,
    protocolError,
    secondsLeft,
    fetchSnapshot,
    submitAction,
    resign,
    serverNow,
    reset,
  };
}
