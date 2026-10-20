import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { socketService } from '../lib/socket';

/**
 * Shared "live score" multiplayer game lifecycle hook.
 *
 * Encapsulates the parts of ArenaBattle and KnowledgeQuiz that were ~70% duplicate:
 * snapshot fetching, opponent resolution, live progress submission, socket subscription,
 * fallback polling, idempotent finish handling, and the final score reconciliation
 * round (`submitScoreAndWaitForWinner`).
 *
 * The host component still owns game-specific UI, round indexing, and the per-tick
 * mechanic — this hook only handles state that is identical across live-score games.
 */

export interface LiveSubmissionState {
  score?: number;
  roundsWon?: number;
  round?: number;
  done?: boolean;
}

export interface LiveGameSnapshot {
  id: string | number;
  status?: string;
  winner?: string | null;
  hostName?: string;
  guestName?: string | null;
  gameState?: {
    resolvedWinner?: string;
    /** Set by the backend after settlement runs; the actual points moved to the winner. */
    stakeTransferred?: number;
    settlementApplied?: boolean;
    live?: {
      submissions?: Record<string, LiveSubmissionState>;
      resolvedWinner?: string;
    };
  };
}

/** Bot/local games never run server settlement; we keep a cosmetic reward so the user
 * still sees a "won X points" toast. Production stats and wallet are unaffected. */
const BOT_WIN_REWARD = 10;

interface GameStateUpdatedPayload {
  type?: string;
  gameId?: string | number;
}

export interface UseLiveScoreGameOptions {
  currentUser: User;
  gameId: string | number | null;
  isBot: boolean;
  /** Game type sent to the server (e.g. 'Nişancı Düellosu', 'Bilgi Yarışı'). */
  mode: string;
  /** Prefix for the idempotent submissionKey (e.g. 'arena', 'quiz'). */
  submissionKeyPrefix: string;
  /** Fallback polling interval in milliseconds. */
  pollIntervalMs?: number;
  /**
   * If set, when the player triggers final-round completion (`isDoneRound=true` in
   * syncLiveProgress) the hook arms a fallback timer; if the server has not yet
   * resolved the winner by then, the host's `finalizeMatch` is invoked locally.
   */
  finalizationTimeoutMs?: number;
  /** Used in error logs to disambiguate concurrent games. Defaults to 'LiveScoreGame'. */
  logName?: string;
  /** Stats `kind` reported to onGameEnd (MatchResultCard chip'leri için). */
  statsKind: 'quiz' | 'arena';
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
}

/** Maç bitiminde hook'un elindeki, sonuç kartında gösterilen istatistikler. */
export interface LiveMatchStats {
  kind: 'quiz' | 'arena';
  playerScore: number;
  opponentScore: number;
  durationMs: number;
}

export interface UseLiveScoreGameResult {
  playerScore: number;
  setPlayerScore: React.Dispatch<React.SetStateAction<number>>;
  opponentScore: number;
  setOpponentScore: React.Dispatch<React.SetStateAction<number>>;
  done: boolean;
  setDone: React.Dispatch<React.SetStateAction<boolean>>;
  resolvingMatch: boolean;
  setResolvingMatch: React.Dispatch<React.SetStateAction<boolean>>;
  hostName: string;
  guestName: string;
  /** Latest live submission `round` value reported by the actor in the snapshot. */
  serverRound: number | null;
  /** Idempotent ref guard so finishFromServer + finalizeMatch can't both fire. */
  finishHandledRef: React.MutableRefObject<boolean>;
  matchStartedAtRef: React.MutableRefObject<number>;
  /** Force a fresh snapshot fetch (no-op for bot/local games). */
  fetchSnapshot: (silent?: boolean) => Promise<LiveGameSnapshot | null>;
  /** Send a live submission to the server. No-op for bot/local games. */
  syncLiveProgress: (score: number, round: number, isDoneRound: boolean) => Promise<void>;
  /** Final reconciliation step — sends total score, waits for server winner. */
  finalizeMatch: (localWinner: string, playerScoreValue: number) => Promise<void>;
  /** Resets all hook-managed state for a fresh match (call when gameId changes). */
  reset: () => void;
}

const normalizeName = (value: unknown) => String(value || '').trim();

export function useLiveScoreGame(options: UseLiveScoreGameOptions): UseLiveScoreGameResult {
  const {
    currentUser,
    gameId,
    isBot,
    mode,
    submissionKeyPrefix,
    pollIntervalMs = 2200,
    finalizationTimeoutMs,
    logName = 'LiveScoreGame',
    statsKind,
    onGameEnd,
  } = options;

  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [serverRound, setServerRound] = useState<number | null>(null);

  const finishHandledRef = useRef(false);
  const matchStartedAtRef = useRef<number>(Date.now());
  const pollRef = useRef<number | null>(null);
  const finalizationTimeoutRef = useRef<number | null>(null);
  // finishFromServer/finalizeMatch'in deps'inde skor state'leri yok (kasıtlı —
  // effect zinciri bozulmasın); güncel skorlar bu ref üzerinden okunur.
  const scoresRef = useRef({ player: 0, opponent: 0 });

  useEffect(() => {
    scoresRef.current = { player: playerScore, opponent: opponentScore };
  }, [playerScore, opponentScore]);

  const buildStats = useCallback(
    (): LiveMatchStats => ({
      kind: statsKind,
      playerScore: scoresRef.current.player,
      opponentScore: scoresRef.current.opponent,
      durationMs: Math.max(0, Date.now() - matchStartedAtRef.current),
    }),
    [statsKind]
  );

  const reset = useCallback(() => {
    finishHandledRef.current = false;
    matchStartedAtRef.current = Date.now();
    setPlayerScore(0);
    setOpponentScore(0);
    setDone(false);
    setResolvingMatch(false);
    setServerRound(null);
    if (finalizationTimeoutRef.current) {
      window.clearTimeout(finalizationTimeoutRef.current);
      finalizationTimeoutRef.current = null;
    }
  }, []);

  const resolveActorAndOpponent = useCallback(
    (snapshot: LiveGameSnapshot) => {
      const actor = normalizeName(currentUser.username).toLowerCase();
      const host = normalizeName(snapshot.hostName);
      const guest = normalizeName(snapshot.guestName);
      if (host && actor === host.toLowerCase()) {
        return { actorName: host, opponentKey: guest };
      }
      if (guest && actor === guest.toLowerCase()) {
        return { actorName: guest, opponentKey: host };
      }
      return { actorName: '', opponentKey: '' };
    },
    [currentUser.username]
  );

  const finishFromServer = useCallback(
    (winnerRaw: string | null, stakeTransferred: number) => {
      if (finishHandledRef.current) return;
      finishHandledRef.current = true;
      if (finalizationTimeoutRef.current) {
        window.clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = null;
      }
      const winner = normalizeName(winnerRaw) || 'Berabere';
      const isWinner = winner.toLowerCase() === normalizeName(currentUser.username).toLowerCase();
      const safeStake = Math.max(0, Math.floor(Number(stakeTransferred) || 0));
      const points = isWinner ? safeStake : 0;
      setDone(true);
      const stats = buildStats();
      window.setTimeout(() => onGameEnd(winner, points, stats), 700);
    },
    [buildStats, currentUser.username, onGameEnd]
  );

  const applySnapshot = useCallback(
    (snapshot: LiveGameSnapshot) => {
      if (snapshot.hostName) setHostName(String(snapshot.hostName));
      if (snapshot.guestName) setGuestName(String(snapshot.guestName));
      const { actorName, opponentKey } = resolveActorAndOpponent(snapshot);
      const submissions = snapshot.gameState?.live?.submissions || {};
      const actorLive = actorName ? submissions[actorName] : undefined;
      const opponentLive = opponentKey ? submissions[opponentKey] : undefined;

      if (typeof actorLive?.score === 'number') {
        setPlayerScore((prev) => Math.max(prev, Number(actorLive.score)));
      }
      if (typeof opponentLive?.score === 'number') {
        setOpponentScore((prev) => Math.max(prev, Number(opponentLive.score)));
      }
      if (typeof actorLive?.round === 'number') {
        const safeRound = Math.max(1, Math.floor(Number(actorLive.round)));
        setServerRound((prev) => (prev === null ? safeRound : Math.max(prev, safeRound)));
      }

      const winner =
        normalizeName(
          snapshot.gameState?.resolvedWinner ||
            snapshot.gameState?.live?.resolvedWinner ||
            snapshot.winner
        ) || null;
      if (String(snapshot.status || '').toLowerCase() === 'finished') {
        const serverStake = Number(snapshot.gameState?.stakeTransferred) || 0;
        finishFromServer(winner, serverStake);
      }
    },
    [finishFromServer, resolveActorAndOpponent]
  );

  const fetchSnapshot = useCallback(
    async (silent = false): Promise<LiveGameSnapshot | null> => {
      if (isBot || !gameId) return null;
      try {
        const snapshot = (await api.games.get(gameId)) as LiveGameSnapshot;
        applySnapshot(snapshot);
        return snapshot;
      } catch (err) {
        if (!silent) {
          console.error(`${logName} snapshot error`, err);
        }
        return null;
      }
    },
    [applySnapshot, gameId, isBot, logName]
  );

  const syncLiveProgress = useCallback(
    async (score: number, round: number, isDoneRound: boolean) => {
      if (isBot || !gameId) return;
      try {
        const safeScore = Math.max(0, Math.min(1000, Math.floor(score)));
        const safeRound = Math.max(0, Math.min(1000, Math.floor(round)));
        await api.games.move(gameId, {
          liveSubmission: {
            mode,
            score: safeScore,
            roundsWon: safeScore,
            round: safeRound,
            done: Boolean(isDoneRound),
            submissionKey: `${submissionKeyPrefix}|${String(gameId)}|${currentUser.username}|${safeRound}|${safeScore}|${isDoneRound ? 1 : 0}`,
          },
        });
      } catch (err) {
        console.error(`${logName} live submission failed`, err);
      }
    },
    [currentUser.username, gameId, isBot, logName, mode, submissionKeyPrefix]
  );

  const finalizeMatch = useCallback(
    async (localWinner: string, playerScoreValue: number) => {
      if (finishHandledRef.current) return;
      if (isBot || !gameId) {
        // Bot/local: no server settlement, show cosmetic reward only.
        const points = localWinner === currentUser.username ? BOT_WIN_REWARD : 0;
        finishHandledRef.current = true;
        // Read the stats when the delay is over: the last answer's score lands in the same
        // tick as this call, so reading it now would leave that answer out.
        window.setTimeout(() => onGameEnd(localWinner, points, buildStats()), 900);
        return;
      }

      setResolvingMatch(true);

      try {
        const durationMs = Math.max(1, Date.now() - matchStartedAtRef.current);
        const { winner, finished } = await submitScoreAndWaitForWinner({
          gameId,
          username: currentUser.username,
          score: playerScoreValue,
          roundsWon: playerScoreValue,
          durationMs,
        });

        if (!finished) {
          finishHandledRef.current = true;
          const pendingStats = buildStats();
          window.setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0, pendingStats), 900);
          return;
        }

        // Re-read snapshot to get the actual `stakeTransferred` the backend wrote
        // during settlement. Without this we'd be guessing the reward amount.
        let serverStake = 0;
        try {
          const finalSnapshot = (await api.games.get(gameId)) as LiveGameSnapshot;
          serverStake = Number(finalSnapshot?.gameState?.stakeTransferred) || 0;
        } catch {
          // Snapshot fetch failed — fall back to zero so we don't fabricate a reward.
        }

        const resolvedWinner = winner || 'Berabere';
        const isWinner = Boolean(winner) && winner === currentUser.username;
        const points = isWinner ? Math.max(0, Math.floor(serverStake)) : 0;
        finishHandledRef.current = true;
        const finalStats = buildStats();
        window.setTimeout(() => onGameEnd(resolvedWinner, points, finalStats), 900);
      } catch {
        finishHandledRef.current = true;
        const errorStats = buildStats();
        window.setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0, errorStats), 900);
      } finally {
        setResolvingMatch(false);
      }
    },
    [buildStats, currentUser.username, gameId, isBot, onGameEnd]
  );

  // Reset state when gameId changes (new match).
  useEffect(() => {
    reset();
  }, [gameId, reset]);

  // Socket subscription + fallback polling for multiplayer games.
  useEffect(() => {
    if (isBot || !gameId) return undefined;

    void fetchSnapshot();
    const socket = socketService.getSocket();
    socketService.joinGame(String(gameId));

    const onRealtime = (payload: GameStateUpdatedPayload) => {
      if (String(payload?.gameId || '') !== String(gameId)) return;
      const type = payload?.type;
      if (
        type === 'live_submission' ||
        type === 'score_submission' ||
        type === 'game_finished' ||
        type === 'game_state'
      ) {
        void fetchSnapshot(true);
      }
    };
    socket.on('game_state_updated', onRealtime);

    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || done) return;
      void fetchSnapshot(true);
    }, pollIntervalMs);

    return () => {
      socket.off('game_state_updated', onRealtime);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [done, fetchSnapshot, gameId, isBot, pollIntervalMs]);

  // Component unmount: clear timers.
  useEffect(
    () => () => {
      if (finalizationTimeoutRef.current) {
        window.clearTimeout(finalizationTimeoutRef.current);
      }
    },
    []
  );

  // When the host signals the final round, arm a fallback finalize timer (opt-in).
  const armFinalizationFallback = useCallback(
    (fallbackLocalWinner: string, playerScoreValue: number) => {
      if (!finalizationTimeoutMs || isBot || !gameId) return;
      if (finalizationTimeoutRef.current) {
        window.clearTimeout(finalizationTimeoutRef.current);
      }
      finalizationTimeoutRef.current = window.setTimeout(() => {
        if (!finishHandledRef.current) {
          void finalizeMatch(fallbackLocalWinner, playerScoreValue);
        }
      }, finalizationTimeoutMs);
    },
    [finalizationTimeoutMs, finalizeMatch, gameId, isBot]
  );

  // Wrap syncLiveProgress so that calling it with isDoneRound=true arms the fallback.
  const syncLiveProgressWithFallback = useCallback(
    async (score: number, round: number, isDoneRound: boolean) => {
      await syncLiveProgress(score, round, isDoneRound);
      if (isDoneRound) {
        const fallbackWinner =
          score >= opponentScore ? currentUser.username : guestName || hostName || 'Rakip';
        armFinalizationFallback(fallbackWinner, score);
      }
    },
    [
      armFinalizationFallback,
      currentUser.username,
      guestName,
      hostName,
      opponentScore,
      syncLiveProgress,
    ]
  );

  return {
    playerScore,
    setPlayerScore,
    opponentScore,
    setOpponentScore,
    done,
    setDone,
    resolvingMatch,
    setResolvingMatch,
    hostName,
    guestName,
    serverRound,
    finishHandledRef,
    matchStartedAtRef,
    fetchSnapshot,
    syncLiveProgress: syncLiveProgressWithFallback,
    finalizeMatch,
    reset,
  };
}
