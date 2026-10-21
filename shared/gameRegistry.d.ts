/**
 * Type definitions for shared/gameRegistry.js.
 */

export type GameMode = 'aim' | 'quiz' | 'chess';

export interface GameRegistryEntry {
  type: string;
  mode: GameMode;
  /** Null for endless games (chess). */
  maxRounds: number | null;
  /** Highest score a submission can carry, null when the game has no numeric cap. */
  maxScore: number | null;
  minPoints: number;
  submissionKeyPrefix: string;
  category: string;
  description: string;
}

export const AIM_GAME_TYPE: string;
export const QUIZ_GAME_TYPE: string;
export const CHESS_GAME_TYPE: string;

export const GAME_REGISTRY: Record<string, GameRegistryEntry>;
export const SUPPORTED_GAME_TYPES: Set<string>;
export const GAME_TYPE_LIST: GameRegistryEntry[];
export const GAME_TYPE_ALIASES: Record<string, string>;

export interface GameScoreBounds {
  maxScore: number | null;
  maxRounds: number | null;
}

/** Authoritative score bounds of a game type, null for an unknown type. */
export function getGameScoreBounds(gameType: string): GameScoreBounds | null;
