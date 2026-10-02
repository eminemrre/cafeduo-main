import React from 'react';

export interface NavItem {
  label: string;
  id: string;
}

export interface GameCardProps {
  title: string;
  icon?: React.ReactNode;
  isNew?: boolean;
  disabled?: boolean;
  content?: React.ReactNode;
}

export interface StepProps {
  number: string;
  text: string;
  isLast?: boolean;
}

export interface User {
  id: string | number;
  username: string;
  email: string;
  table?: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  department?: string;
  isAdmin?: boolean;
  role?: 'user' | 'admin' | 'cafe_admin';
  cafe_id?: string | number;
  cafe_name?: string;
  table_number?: string;
  avatar_url?: string;
  bonusReceived?: boolean;
}

export interface UserProfileUpdates {
  department?: string;
  avatar_url?: string | null;
}

export interface GameRequest {
  id: string | number;
  hostName: string;
  gameType: string;
  points: number;
  table: string;
  status: 'waiting' | 'active' | 'finishing' | 'finished' | 'playing';
  guestName?: string;
  player1Move?: string;
  player2Move?: string;
  gameState?: unknown;
  chessClock?: {
    baseSeconds: number;
    incrementSeconds: number;
    label?: string;
  };
}

export interface GameHistoryEntry {
  id: string | number;
  gameType: string;
  points: number;
  status: string;
  table: string;
  opponentName: string;
  winner: string | null;
  didWin: boolean;
  createdAt: string;
  moveCount?: number;
  chessTempo?: string | null;
}

export interface AdminGameRow {
  id: number;
  host_name: string;
  guest_name: string | null;
  game_type: string;
  status: string;
  created_at: string;
  cafe_name?: string | null;
  table_code?: string | null;
}

export interface Achievement {
  id: string | number;
  title: string;
  description: string;
  icon: string;
  points_reward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface Reward {
  id: string | number;
  title: string;
  cost: number;
  description: string;
  icon: 'coffee' | 'discount' | 'dessert' | 'game' | string;
  is_active?: boolean;
}

export interface RedeemedReward extends Reward {
  redeemId: string;
  redeemedAt: Date;
  code: string;
  isUsed: boolean;
}

export interface Cafe {
  id: string | number;
  name: string;
  address?: string;
  total_tables?: number;
  pin?: string;
  daily_pin?: string;
  table_count?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  secondary_latitude?: number;
  secondary_longitude?: number;
  secondary_radius?: number;
  /** PR #36 — per-cafe daily game limit. Default 10. Set by cafe admin. */
  daily_game_limit?: number;
  /** Same field, camelCase — admin update endpoint accepts both. */
  dailyGameLimit?: number;
  /** PR #36 — per-cafe daily reward wheel slices ({points, weight}[]). */
  daily_reward_wheel?: Array<{ points: number; weight: number }>;
  /** Same field, camelCase — admin update endpoint accepts both. */
  dailyRewardWheel?: Array<{ points: number; weight: number }>;
}

export interface BuildMeta {
  version: string;
  shortVersion: string;
  buildTime: string;
}

export interface DeleteCafeCleanup {
  detachedUsers: number;
  cafeAdminsDemoted: number;
  rewardsDeleted: number;
  gamesForceClosed: number;
}

export interface DeleteCafeResult {
  success: boolean;
  deletedCafe: {
    id: string | number;
    name: string;
  };
  cleanup: DeleteCafeCleanup;
}

export type TournamentStatus = 'scheduled' | 'active' | 'finalizing' | 'finished' | 'cancelled';

export interface TournamentPrizeTier {
  rank: number;
  reward_id: number;
}

export interface Tournament {
  id: number;
  cafe_id: number;
  name: string;
  game_type: string | null;
  start_at: string;
  end_at: string;
  status: TournamentStatus;
  prize_tiers: TournamentPrizeTier[];
  created_by: number | null;
  created_at: string;
  finalized_at: string | null;
}

export interface TournamentLeaderboardRow {
  id: number;
  username: string;
  avatar_url: string | null;
  total_points: number;
  games_counted: number;
}

export interface TournamentLeaderboardResponse {
  tournament: Pick<
    Tournament,
    'id' | 'cafe_id' | 'name' | 'status' | 'start_at' | 'end_at' | 'prize_tiers'
  >;
  leaderboard: TournamentLeaderboardRow[];
}
