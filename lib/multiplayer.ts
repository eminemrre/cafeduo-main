import { api } from './api';

export interface ScoreResult {
  score: number;
  roundsWon?: number;
  durationMs?: number;
  submittedAt?: string;
}

type Scoreboard = Record<string, ScoreResult>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeName = (value: unknown) => String(value || '').trim();

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const filterScoreboardToParticipants = (
  scoreboard: Scoreboard,
  participants: string[]
): Scoreboard => {
  if (!participants.length) return scoreboard;

  const participantByLower = new Map(
    participants
      .map((participant) => normalizeName(participant))
      .filter(Boolean)
      .map((participant) => [participant.toLowerCase(), participant])
  );

  const filtered: Scoreboard = {};
  for (const [name, result] of Object.entries(scoreboard || {})) {
    const canonical = participantByLower.get(normalizeName(name).toLowerCase());
    if (canonical) {
      filtered[canonical] = result;
    }
  }

  return filtered;
};

export const pickWinnerFromScoreboard = (scoreboard: Scoreboard): string | null => {
  const entries = Object.entries(scoreboard);
  if (entries.length < 2) return null;

  entries.sort((a, b) => {
    const scoreDiff = toSafeNumber(b[1]?.score) - toSafeNumber(a[1]?.score);
    if (scoreDiff !== 0) return scoreDiff;

    const roundsDiff = toSafeNumber(b[1]?.roundsWon) - toSafeNumber(a[1]?.roundsWon);
    if (roundsDiff !== 0) return roundsDiff;

    // Daha kısa süre daha iyi (0 veya undefined en sona gitsin)
    const aDuration = toSafeNumber(a[1]?.durationMs, Number.MAX_SAFE_INTEGER);
    const bDuration = toSafeNumber(b[1]?.durationMs, Number.MAX_SAFE_INTEGER);
    if (aDuration !== bDuration) return aDuration - bDuration;

    // Son çare: daha erken submit eden
    const aSubmitted = new Date(a[1]?.submittedAt || 0).getTime();
    const bSubmitted = new Date(b[1]?.submittedAt || 0).getTime();
    return aSubmitted - bSubmitted;
  });

  return entries[0]?.[0] || null;
};

export const submitScoreAndWaitForWinner = async (params: {
  gameId: number | string;
  username: string;
  score: number;
  roundsWon?: number;
  durationMs?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<{ winner: string | null; timedOut: boolean; scoreboard: Scoreboard }> => {
  const {
    gameId,
    username,
    score,
    roundsWon,
    durationMs,
    timeoutMs = 45000,
    pollIntervalMs = 1500,
  } = params;

  await api.games.submitScore(gameId, {
    username,
    score,
    roundsWon,
    durationMs,
  });

  const deadline = Date.now() + timeoutMs;
  let scoreboard: Scoreboard = {};

  while (Date.now() < deadline) {
    try {
      const game = await api.games.get(gameId);
      const participants = [normalizeName(game?.hostName), normalizeName(game?.guestName)].filter(Boolean);
      const gameState = game?.gameState;
      const maybeResults =
        gameState && typeof gameState === 'object'
          ? (gameState as { results?: unknown }).results
          : undefined;
      const rawScoreboard =
        maybeResults && typeof maybeResults === 'object' && !Array.isArray(maybeResults)
          ? (maybeResults as Scoreboard)
          : {};
      scoreboard = filterScoreboardToParticipants(rawScoreboard, participants);
      const winner = pickWinnerFromScoreboard(scoreboard);
      if (winner) {
        return { winner, timedOut: false, scoreboard };
      }
    } catch {
      // Polling sırasında geçici hataları yumuşat
    }

    await sleep(pollIntervalMs);
  }

  return {
    winner: pickWinnerFromScoreboard(scoreboard),
    timedOut: true,
    scoreboard,
  };
};
