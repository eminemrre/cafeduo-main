import { api } from './api';
import type { CompetitiveActionEnvelope, CompetitiveEngineState, CompetitiveGame } from '../types';

export const COMPETITIVE_PROTOCOL_VERSION = 2;

export const isCompetitiveGameType = (gameType: unknown): boolean => {
  const type = String(gameType || '').trim();
  return type === 'Bilgi Yarışı' || type === 'Nişancı Düellosu';
};

export const engineOf = (snapshot: CompetitiveGame | null | undefined) =>
  (snapshot?.gameState?.engine as CompetitiveEngineState | undefined) || null;

export type ActorKey = 'host' | 'guest';

const normalizeName = (value: unknown) => String(value || '').trim();

export const actorKeyFor = (
  snapshot: CompetitiveGame | null | undefined,
  username: string
): ActorKey | null => {
  const actor = normalizeName(username).toLowerCase();
  if (!actor) return null;
  if (normalizeName(snapshot?.hostName).toLowerCase() === actor) return 'host';
  if (normalizeName(snapshot?.guestName).toLowerCase() === actor) return 'guest';
  return null;
};

export const opponentNameFor = (
  snapshot: CompetitiveGame | null | undefined,
  actorKey: ActorKey | null
): string => {
  if (actorKey === 'host') return normalizeName(snapshot?.guestName);
  if (actorKey === 'guest') return normalizeName(snapshot?.hostName);
  return '';
};

export const createActionId = (prefix: string): string => {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${randomPart}`.slice(0, 64);
};

export const secondsLeftAt = (endsAt: string | null | undefined, nowMs: number): number => {
  const end = Date.parse(String(endsAt || ''));
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - nowMs) / 1000));
};

/**
 * The server is the only clock that matters. A snapshot carries `serverNow`;
 * network latency makes this an estimate, used for drawing and countdown only.
 * The score still comes from the server's receive time.
 */
export const serverClockOffset = (
  snapshot: CompetitiveGame | null | undefined,
  receivedAt = Date.now()
): number => {
  const serverNow = Date.parse(String(snapshot?.serverNow || ''));
  if (!Number.isFinite(serverNow)) return 0;
  return serverNow - receivedAt;
};

export const isProtocolV2 = (snapshot: CompetitiveGame | null | undefined): boolean =>
  snapshot?.protocolVersion === COMPETITIVE_PROTOCOL_VERSION &&
  engineOf(snapshot)?.version === COMPETITIVE_PROTOCOL_VERSION;

/**
 * Forfeit is still an engine action, not a legacy `/resign` write. The current
 * round id is read from the verified snapshot; the server picks the opponent
 * as the winner when it applies the action.
 */
export const resignCompetitiveGame = async (gameId: string | number): Promise<void> => {
  // The round can advance between the snapshot and the action. Retry once with
  // the fresh round id instead of silently walking away from an unsettled game.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = (await api.games.get(gameId)) as CompetitiveGame;
    const engine = engineOf(snapshot);
    if (!engine || engine.phase === 'finished' || !engine.round?.id) return;
    const payload: CompetitiveActionEnvelope = {
      actionId: createActionId('resign'),
      roundId: engine.round.id,
      type: 'resign',
    };
    try {
      await api.games.action(gameId, payload);
      return;
    } catch (error) {
      const status = Number((error as { status?: number })?.status || 0);
      const code = String((error as { code?: string })?.code || '');
      const retryable = status === 409 || code === 'STALE_ROUND' || code === 'ROUND_NOT_OPEN';
      if (attempt === 0 && retryable) continue;
      throw error;
    }
  }
};
