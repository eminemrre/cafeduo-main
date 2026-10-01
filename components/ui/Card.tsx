/**
 * Card — Riso Kantin primitive.
 *
 * Rounded paper surfaces and subtle shadows group content without competing
 * with game actions. Nested cards should use `shadow="none"`.
 *
 * Surface tones map to CSS vars defined under `.riso-kantin` in index.css;
 * the wrapping body class must be present for tones to resolve.
 */

import React from 'react';

export type CardTone = 'paper' | 'paper-deep' | 'pink' | 'blue' | 'mustard';

interface CardProps {
  children: React.ReactNode;
  /** Surface colour. Ink text stays dark except on `blue` which inverts. */
  tone?: CardTone;
  /** Sticker-pinned rotation in degrees. Use -2..+2, sparingly. */
  rotation?: number;
  /** Shadow weight. 'none' for nested cards inside modals. */
  shadow?: 'sm' | 'md' | 'none';
  /** Halftone overlay — auto-enabled on warm surfaces; opt-out with false. */
  halftone?: boolean;
  className?: string;
  /** Render as a different element (e.g. 'section', 'article'). */
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer';
  'data-testid'?: string;
}

const TONE_CLASS: Record<CardTone, string> = {
  paper: 'bg-paper text-carbon',
  'paper-deep': 'bg-paper-deep text-carbon',
  pink: 'bg-riso-pink text-carbon',
  blue: 'bg-riso-blue text-paper',
  mustard: 'bg-riso-mustard text-carbon',
};

const SHADOW_CLASS: Record<NonNullable<CardProps['shadow']>, string> = {
  sm: 'riso-shadow-sm',
  md: 'riso-shadow-md',
  none: '',
};

export const Card: React.FC<CardProps> = ({
  children,
  tone = 'paper',
  rotation = 0,
  shadow = 'md',
  halftone,
  className = '',
  as: Tag = 'div',
  'data-testid': testId,
}) => {
  const showHalftone =
    halftone ?? (tone === 'paper' || tone === 'paper-deep' || tone === 'mustard');

  return (
    <Tag
      data-testid={testId}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
      className={[
        'duo-card relative isolate border-2 border-carbon p-5 sm:p-6',
        'transition-[box-shadow,transform] duration-150 ease-out',
        TONE_CLASS[tone],
        SHADOW_CLASS[shadow],
        showHalftone ? 'riso-halftone' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
};
