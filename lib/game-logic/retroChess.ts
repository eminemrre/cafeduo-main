import { Chess, type Square } from 'chess.js';

export interface DrawOfferState {
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  offeredBy: string;
  createdAt: string;
  respondedBy?: string;
  respondedAt?: string;
}

export interface ChessClockState {
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
  label: string;
  lastTickAt: string | null;
}

const DRAW_OFFER_STATUSES = new Set(['pending', 'accepted', 'rejected', 'cancelled']);

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const normalizeWinner = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  return raw ? raw : null;
};

export const loadChess = (fen: unknown) => {
  try {
    const resolvedFen = String(fen || '').trim();
    if (!resolvedFen) return new Chess();
    return new Chess(resolvedFen);
  } catch {
    return new Chess();
  }
};

export const toSquare = (file: string, rank: string) => `${file}${rank}` as Square;

export const inferResultLabel = (engine: Chess): string => {
  if (engine.isCheckmate()) return 'Şah mat';
  if (engine.isStalemate()) return 'Pat';
  if (engine.isThreefoldRepetition()) return 'Üçlü tekrar';
  if (engine.isInsufficientMaterial()) return 'Yetersiz materyal';
  if (engine.isDraw()) return 'Berabere';
  return 'Oyun bitti';
};

export const formatClock = (rawMs: number): string => {
  const ms = Math.max(0, Math.floor(Number(rawMs) || 0));
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const parseRetryAfterMs = (message: string): number => {
  const found = message.match(/(\d+)\s*sn/i);
  const seconds = found ? Number(found[1]) : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
};

export const normalizeDrawOfferState = (value: unknown): DrawOfferState | null => {
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

export const buildClockState = (clock: unknown, fallbackLabel = '3+2'): ChessClockState | null => {
  if (!clock || typeof clock !== 'object') return null;
  const source = clock as Record<string, unknown>;
  return {
    whiteMs: Math.max(0, Number(source.whiteMs || 0)),
    blackMs: Math.max(0, Number(source.blackMs || 0)),
    incrementMs: Math.max(0, Number(source.incrementMs || 0)),
    label: String(source.label || fallbackLabel),
    lastTickAt: source.lastTickAt ? String(source.lastTickAt) : null,
  };
};

export const extractLastMove = (
  moveHistory: Array<{ from: string; to: string }> | null | undefined
): { from: Square; to: Square } | null => {
  if (!Array.isArray(moveHistory) || moveHistory.length === 0) return null;
  const lastMove = moveHistory[moveHistory.length - 1];
  return { from: lastMove.from as Square, to: lastMove.to as Square };
};

export const derivePlayerColor = ({
  isBot,
  currentUsername,
  hostName,
  guestName,
}: {
  isBot: boolean;
  currentUsername: string;
  hostName?: string;
  guestName?: string;
}): 'w' | 'b' | null => {
  if (isBot) return 'w';
  const actor = String(currentUsername || '').trim().toLowerCase();
  if (hostName && actor === hostName.trim().toLowerCase()) return 'w';
  if (guestName && actor === guestName.trim().toLowerCase()) return 'b';
  return null;
};

export const deriveOpponentLabel = ({
  isBot,
  playerColor,
  guestName,
  hostName,
  opponentName,
}: {
  isBot: boolean;
  playerColor: 'w' | 'b' | null;
  guestName?: string;
  hostName?: string;
  opponentName?: string;
}) => {
  if (isBot) return 'BOT';
  if (playerColor === 'w') return guestName || opponentName || 'Rakip';
  return hostName || opponentName || 'Rakip';
};

export const deriveDisplayClock = ({
  clockState,
  serverStatus,
  turn,
  nowMs = Date.now(),
}: {
  clockState: ChessClockState;
  serverStatus: string;
  turn: 'w' | 'b';
  nowMs?: number;
}) => {
  const whiteBase = Math.max(0, Number(clockState.whiteMs || 0));
  const blackBase = Math.max(0, Number(clockState.blackMs || 0));
  const startedAt = clockState.lastTickAt ? Date.parse(clockState.lastTickAt) : Number.NaN;
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, nowMs - startedAt) : 0;

  if (serverStatus === 'finished') {
    return { white: whiteBase, black: blackBase };
  }

  if (turn === 'w') {
    return { white: Math.max(0, whiteBase - elapsed), black: blackBase };
  }

  return { white: whiteBase, black: Math.max(0, blackBase - elapsed) };
};

export const shouldPollSnapshot = ({
  isBot,
  hasGameId,
  serverStatus,
  pollPauseUntil,
  lastRealtimeAt,
  visibilityState,
  nowMs = Date.now(),
}: {
  isBot: boolean;
  hasGameId: boolean;
  serverStatus: string;
  pollPauseUntil: number;
  lastRealtimeAt: number;
  visibilityState?: string;
  nowMs?: number;
}) => {
  if (isBot || !hasGameId) return false;
  if (visibilityState === 'hidden') return false;
  if (serverStatus === 'finished') return false;
  if (nowMs < pollPauseUntil) return false;
  if (nowMs - lastRealtimeAt < 14000) return false;
  return true;
};
