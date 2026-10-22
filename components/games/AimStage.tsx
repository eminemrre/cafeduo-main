/**
 * AimStage — the Nişancı Düellosu field.
 *
 * A lokum field with the game's target toy in the middle. The target is drawn
 * at the real scale of the scoring zones: the stage is 100 gauge units wide and
 * the board spans 40 of them, so each ring edge sits exactly where the server
 * changes the points (`AIM_ZONES`). Darts land on the centre line at the
 * revealed positions: the player's from above, the opponent's from below.
 *
 * Everything is DOM and SVG, so the stage reads the same without WebGL. The
 * reticle and the round timer move in a requestAnimationFrame loop that writes
 * styles directly; React only re-renders when darts or feedback change.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AIM_ZONES } from '../../lib/aimTrajectory';

export interface AimDart {
  round: number;
  side: 'me' | 'op';
  position: number;
  /** A shot the server has not confirmed yet: drawn faint until the reveal. */
  ghost?: boolean;
}

export interface AimFeedback {
  key: string;
  points: number;
  position: number;
}

interface AimStageProps {
  round: number;
  maxRounds: number;
  /** Current reticle position in gauge units, or null to hide the reticle. */
  readPosition: () => number | null;
  /** Remaining share of the round (1 → 0), or null when there is no clock. */
  readTimeLeft: () => number | null;
  darts: AimDart[];
  feedback: AimFeedback | null;
}

/** Board radius in gauge units: the 0-point rim around the scoring rings. */
const BOARD_RADIUS = 20;
const [BULL, INNER, OUTER] = AIM_ZONES.map((zone) => zone.maxDistance);

const zoneLabel = AIM_ZONES.map(
  (zone) => `merkezden ${String(zone.maxDistance).replace('.', ',')} birim ${zone.points} puan`
).join(', ');

const TargetBoard: React.FC = () => (
  <svg viewBox="-20 -20 40 40" className="h-full w-full" aria-hidden="true">
    <circle r={BOARD_RADIUS} fill="#D9EAEF" />
    <circle r={OUTER} fill="#FFFFFF" />
    <circle r={INNER} fill="#FF5C8A" />
    <circle r={BULL} fill="#17140F" />
    <text x="0" y={-(OUTER + INNER) / 2 + 1.4} className="duo-aim-ring-label" textAnchor="middle">
      1
    </text>
    <text x="0" y={-(INNER + BULL) / 2 + 1.4} className="duo-aim-ring-label" textAnchor="middle">
      2
    </text>
  </svg>
);

const Dart: React.FC<{ dart: AimDart }> = ({ dart }) => {
  const mine = dart.side === 'me';
  const body = mine ? '#17140F' : '#FFFFFF';
  const edge = mine ? '#FFFFFF' : '#17140F';
  const text = mine ? '#FFFFFF' : '#17140F';
  // Drawn pointing down (tip at the bottom); the opponent's dart is flipped.
  return (
    <div
      className={`duo-aim-dart duo-aim-dart--${dart.side}${dart.ghost ? ' duo-aim-dart--ghost' : ''}`}
      style={{ left: `${dart.position}%`, zIndex: 10 + dart.round }}
      data-testid={`arena-dart-${dart.side}-${dart.round}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 50" className="h-full w-full">
        <g transform={mine ? undefined : 'rotate(180 12 25)'}>
          <path d="M12 50 L9 40 L9 20 L15 20 L15 40 Z" fill={body} stroke={edge} strokeWidth="2" />
          <rect x="1" y="1" width="22" height="19" fill={body} stroke={edge} strokeWidth="2" />
        </g>
        <text
          x="12"
          y={mine ? 15.5 : 45.5}
          textAnchor="middle"
          className="duo-aim-dart-label"
          fill={text}
        >
          {dart.round}
        </text>
      </svg>
    </div>
  );
};

export const AimStage: React.FC<AimStageProps> = ({
  round,
  maxRounds,
  readPosition,
  readTimeLeft,
  darts,
  feedback,
}) => {
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const readPositionRef = useRef(readPosition);
  const readTimeLeftRef = useRef(readTimeLeft);

  useLayoutEffect(() => {
    readPositionRef.current = readPosition;
    readTimeLeftRef.current = readTimeLeft;
  }, [readPosition, readTimeLeft]);

  const paint = useCallback(() => {
    const reticle = reticleRef.current;
    if (reticle) {
      const position = readPositionRef.current();
      if (position === null) {
        reticle.style.visibility = 'hidden';
      } else {
        reticle.style.visibility = 'visible';
        reticle.style.left = `${position}%`;
      }
    }
    const timer = timerRef.current;
    if (timer) {
      const left = readTimeLeftRef.current();
      timer.style.visibility = left === null ? 'hidden' : 'visible';
      timer.style.transform = `scaleX(${left === null ? 0 : Math.max(0, Math.min(1, left))})`;
    }
  }, []);

  // Paint synchronously once so the first frame never shows a stale reticle.
  useLayoutEffect(() => {
    paint();
  }, [paint, readPosition, readTimeLeft]);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      paint();
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [paint]);

  const popupLeft = feedback ? Math.max(12, Math.min(88, feedback.position)) : 50;

  return (
    <div
      className="duo-aim-stage"
      role="img"
      aria-label={`Hedef tahtası: ${zoneLabel}, daha uzak atış 0 puan.`}
      data-testid="arena-stage"
    >
      <div ref={timerRef} className="duo-aim-timer" aria-hidden="true" />
      <p className="duo-aim-round" aria-hidden="true">
        Tur{' '}
        <span data-testid="arena-round">
          {Math.min(round, maxRounds)} / {maxRounds}
        </span>
      </p>
      <div
        key={feedback && feedback.points > 0 ? feedback.key : 'still'}
        className={`duo-aim-target${feedback && feedback.points > 0 ? ' duo-aim-target--hit' : ''}`}
      >
        <TargetBoard />
      </div>
      {darts.map((dart) => (
        <Dart key={`${dart.side}-${dart.round}${dart.ghost ? '-ghost' : ''}`} dart={dart} />
      ))}
      <div
        ref={reticleRef}
        className="duo-aim-reticle"
        data-testid="arena-reticle"
        aria-hidden="true"
      >
        <svg viewBox="0 0 52 52" className="h-full w-full">
          <circle cx="26" cy="26" r="21" fill="none" stroke="#17140F" strokeWidth="4" />
          <path d="M26 1v13M26 38v13M1 26h13M38 26h13" stroke="#17140F" strokeWidth="4" />
          <circle cx="26" cy="26" r="3" fill="#17140F" />
        </svg>
      </div>
      {feedback && (
        <span
          key={feedback.key}
          className="duo-aim-pop"
          style={{ left: `${popupLeft}%` }}
          aria-hidden="true"
        >
          {feedback.points > 0 ? `+${feedback.points}` : 'Iska'}
        </span>
      )}
    </div>
  );
};

export default AimStage;
