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
  id: number;
  username: string;
  email: string;
  table?: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  department?: string;
  isAdmin?: boolean;
  role?: 'user' | 'admin' | 'cafe_admin';
  cafeId?: number;
}

export interface GameRequest {
  id: number;
  hostName: string;
  gameType: string;
  points: number;
  table: string;
  status: 'waiting' | 'active' | 'finished';
}

export interface Reward {
  id: number;
  title: string;
  cost: number;
  description: string;
  icon: 'coffee' | 'discount' | 'dessert' | 'game';
}

export interface RedeemedReward extends Reward {
  redeemId: string;
  redeemedAt: Date;
  code: string;
}