/**
 * ChessPieceIcons — Riso Kantin chess piece SVGs (PR #28).
 *
 * Six inline SVG components (Pawn / Rook / Knight / Bishop / Queen / King)
 * designed in the printed-zine aesthetic: chunky 2px ink stroke with
 * paper or ink solid fill. White pieces are paper #FFFFFF + ink stroke,
 * black pieces are ink #17140F + ink stroke. Single shared viewBox
 * (0 0 45 45 — standard chess SVG convention) so they line up in a grid.
 *
 * Choice of inline SVG over file assets:
 *   - no extra HTTP requests, no asset pipeline change
 *   - themeable via fill/stroke props (future dark mode, accent overrides)
 *   - tree-shakes per-piece import (only what RetroChess actually uses)
 *   - clean diff for design tweaks
 *
 * Paths drawn freehand in the Riso aesthetic: simplified silhouettes,
 * thick ink outline, no fine detail. Deliberately not a copy of Wikipedia's
 * Cburnett set — those are technically excellent but too thin/elegant for
 * the chunky printed-zine vibe.
 */

import React from 'react';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

interface ChessPieceIconProps {
  type: PieceType;
  color: PieceColor;
  size?: number;
  className?: string;
}

const FILL_WHITE = '#FFFFFF'; // paper
const FILL_BLACK = '#17140F'; // ink
const STROKE = '#17140F'; // ink for all outlines

const SHARED_PROPS = {
  viewBox: '0 0 45 45',
  strokeWidth: 2.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fillRule: 'evenodd' as const,
};

const renderPath = (type: PieceType): React.ReactNode => {
  switch (type) {
    case 'p':
      // Pawn — round head, tapered neck, dome body, stepped base
      return (
        <>
          <circle cx="22.5" cy="11" r="4.5" />
          <path d="M 18 13.5 Q 16 18 18 22 L 27 22 Q 29 18 27 13.5 Q 25 12 22.5 12 Q 20 12 18 13.5 z" />
          <path d="M 16 22 L 29 22 L 31 26 L 14 26 z" />
          <path d="M 12 26 L 33 26 L 35 33 L 10 33 z" />
          <path d="M 9 33 L 36 33 L 38 38 L 7 38 z" />
        </>
      );
    case 'r':
      // Rook — crenellated tower, sturdy body
      return (
        <>
          <path d="M 9 9 L 9 14 L 12.5 14 L 12.5 11 L 16.5 11 L 16.5 14 L 20.5 14 L 20.5 11 L 24.5 11 L 24.5 14 L 28.5 14 L 28.5 11 L 32.5 11 L 32.5 14 L 36 14 L 36 9 z" />
          <path d="M 11 14 L 11 31 L 34 31 L 34 14 z" />
          <path d="M 9 31 L 36 31 L 36 35 L 9 35 z" />
          <path d="M 7 35 L 38 35 L 38 39 L 7 39 z" />
        </>
      );
    case 'n':
      // Knight — horse head profile, flowing mane, base
      return (
        <>
          <path d="M 22 10 C 32.5 11 38.5 18 38 39 L 15 39 C 15 30 25 32 23 18 C 20 23 17 25 11 27 C 11 22 11 19 14 16 C 11 16 9 14 11 11 C 14 11 16 13 17 12 C 19 11 21 10 22 10 z" />
          <circle cx="17.5" cy="16" r="1.2" fill={STROKE} />
          <path d="M 14.5 17 L 13 18.5" />
        </>
      );
    case 'b':
      // Bishop — pointed mitre with slit, dome body, base
      return (
        <>
          <circle cx="22.5" cy="8" r="2.5" />
          <path d="M 18 12 Q 14 18 15 26 L 30 26 Q 31 18 27 12 Q 25 11 22.5 11 Q 20 11 18 12 z" />
          <path d="M 19 18 L 26 18" />
          <path d="M 20 21 L 25 21" />
          <path d="M 12 26 L 33 26 L 35 30 L 10 30 z" />
          <path d="M 9 30 L 36 30 L 38 35 L 7 35 z" />
          <path d="M 7 35 L 38 35 L 38 39 L 7 39 z" />
        </>
      );
    case 'q':
      // Queen — crown with 5 spikes + dots, body, wide base
      return (
        <>
          <circle cx="9" cy="9" r="1.7" />
          <circle cx="16" cy="6" r="1.7" />
          <circle cx="22.5" cy="5" r="1.7" />
          <circle cx="29" cy="6" r="1.7" />
          <circle cx="36" cy="9" r="1.7" />
          <path d="M 9 11 L 12 22 L 16 9 L 18 22 L 22.5 9 L 27 22 L 29 9 L 33 22 L 36 11 L 36 23 L 9 23 z" />
          <path d="M 9 23 L 36 23 L 35 27 L 10 27 z" />
          <path d="M 11 27 L 34 27 L 33 31 L 12 31 z" />
          <path d="M 9 31 L 36 31 L 38 35 L 7 35 z" />
          <path d="M 7 35 L 38 35 L 38 39 L 7 39 z" />
        </>
      );
    case 'k':
      // King — cross on top, crown, body, wide base
      return (
        <>
          <path d="M 22.5 4 L 22.5 11 M 19.5 7 L 25.5 7" />
          <path d="M 20 11 L 25 11 L 25 14 L 28 14 Q 30 16 30 19 L 26 19 L 26 22 L 19 22 L 19 19 L 15 19 Q 15 16 17 14 L 20 14 z" />
          <path d="M 14 22 L 31 22 L 33 26 L 12 26 z" />
          <path d="M 11 26 L 34 26 L 35 30 L 10 30 z" />
          <path d="M 9 30 L 36 30 L 38 35 L 7 35 z" />
          <path d="M 7 35 L 38 35 L 38 39 L 7 39 z" />
        </>
      );
    default:
      return null;
  }
};

export const ChessPieceIcon: React.FC<ChessPieceIconProps> = ({
  type,
  color,
  size = 36,
  className = '',
}) => {
  const fill = color === 'w' ? FILL_WHITE : FILL_BLACK;
  return (
    <svg width={size} height={size} {...SHARED_PROPS} className={className} aria-hidden="true">
      <g fill={fill} stroke={STROKE}>
        {renderPath(type)}
      </g>
    </svg>
  );
};

/**
 * Human-readable Turkish piece labels — kept here next to the icons so any
 * a11y consumer (RetroChess aria-label) can import from one source of truth.
 */
export const PIECE_LABEL_TR: Record<PieceType, string> = {
  p: 'Piyon',
  n: 'At',
  b: 'Fil',
  r: 'Kale',
  q: 'Vezir',
  k: 'Şah',
};
