/**
 * Admin Badge — a square chip in the v2 language: candy fills carry ink text,
 * ink and danger carry paper text. Sentence case, no tracking.
 */
import React from 'react';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-paper-deep text-carbon',
  primary: 'bg-carbon text-paper',
  success: 'bg-riso-spring text-carbon',
  warning: 'bg-riso-mustard text-carbon',
  danger: 'bg-riso-redox text-paper',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children, className = '' }) => (
  <span
    className={
      'inline-flex items-center px-2 py-0.5 font-riso-body ' +
      `text-[0.8125rem] font-semibold ${toneClass[tone]} ${className}`
    }
  >
    {children}
  </span>
);
