/**
 * Admin Badge — Riso Kantin re-skin (PR #24). API preserved.
 *
 * No rounded-full anymore (Riso = printed, hard edges). Each tone uses one
 * of the spot colours over a paper background with a 2px ink border.
 */
import React from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-paper text-carbon border-carbon',
  primary: 'bg-riso-pink text-carbon border-carbon',
  success: 'bg-riso-spring text-carbon border-carbon',
  warning: 'bg-riso-mustard text-carbon border-carbon',
  danger: 'bg-riso-redox text-paper border-carbon',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => (
  <span
    className={
      'inline-flex items-center px-2 py-0.5 border-2 font-riso-body ' +
      `text-xs font-bold uppercase tracking-[0.08em] ${toneClass[tone]} ${className}`
    }
  >
    {children}
  </span>
);
