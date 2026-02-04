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
}

export interface GameRequest {
  id: string | number;
  hostName: string;
  gameType: string;
  points: number;
  table: string;
  status: 'waiting' | 'active' | 'finished' | 'playing';
  guestName?: string;
  player1Move?: string;
  player2Move?: string;
  gameState?: any;
}

export interface Reward {
  id: string | number;
  title: string;
  cost: number;
  description: string;
  icon: 'coffee' | 'discount' | 'dessert' | 'game' | string;
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
}