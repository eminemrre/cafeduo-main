/**
 * Card — a surface of the v2 Masa register (DESIGN.md, panel-surface): paper or
 * an ice well, square, no border and no shadow. Candy tones are for a game's
 * own surface or the one primary area; text on them stays ink.
 */

import React from 'react';

export type CardTone = 'paper' | 'paper-deep' | 'pink' | 'blue' | 'mustard';

interface CardProps {
  children: React.ReactNode;
  /** Surface colour; ink text on every tone. */
  tone?: CardTone;
  className?: string;
  /** Render as a different element (e.g. 'section', 'article'). */
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer';
  'data-testid'?: string;
}

const TONE_CLASS: Record<CardTone, string> = {
  paper: 'bg-paper text-carbon',
  'paper-deep': 'bg-paper-deep text-carbon',
  pink: 'bg-riso-pink text-carbon',
  blue: 'bg-riso-blue text-carbon',
  mustard: 'bg-riso-mustard text-carbon',
};

export const Card: React.FC<CardProps> = ({
  children,
  tone = 'paper',
  className = '',
  as: Tag = 'div',
  'data-testid': testId,
}) => (
  <Tag
    data-testid={testId}
    className={['duo-card relative p-5 sm:p-6', TONE_CLASS[tone], className]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </Tag>
);
