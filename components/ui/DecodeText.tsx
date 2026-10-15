/**
 * DecodeText — matrix-style reveal for loading and waiting labels.
 *
 * The clock lives here (requestAnimationFrame, throttled to the study's
 * 15 fps); frame content comes from the pure decodeFrame() helper so the
 * reveal maths is testable without a browser.
 *
 * Accessibility: the target text is carried by aria-label, the painted noise
 * is aria-hidden. prefers-reduced-motion skips the reveal entirely.
 */
import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { decodeFrame, DEFAULT_LETTERS_PER_SECOND, DEFAULT_REFRESH_MS } from '../../lib/decodeText';

type AsTag = 'span' | 'div' | 'p' | 'h1' | 'h2';

interface DecodeTextProps {
  /** Final text; shown verbatim when motion is reduced. */
  text: string;
  as?: AsTag;
  className?: string;
  /** Milliseconds to wait before the reveal starts. */
  delayMs?: number;
  /** Characters resolved per second. */
  lettersPerSecond?: number;
  /** Redraw interval in ms. */
  refreshMs?: number;
  'data-testid'?: string;
}

export const DecodeText: React.FC<DecodeTextProps> = ({
  text,
  as: Tag = 'span',
  className,
  delayMs = 0,
  lettersPerSecond = DEFAULT_LETTERS_PER_SECOND,
  refreshMs = DEFAULT_REFRESH_MS,
  ...rest
}) => {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? text : '');

  useEffect(() => {
    if (reduce) {
      setValue(text);
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    let lastPaint = -Infinity;

    const tick = (now: number) => {
      if (startTime === null) startTime = now + delayMs;
      const elapsed = now - startTime;
      if (elapsed >= 0 && now - lastPaint >= refreshMs) {
        lastPaint = now;
        const frame = decodeFrame(text, elapsed, { lettersPerSecond });
        setValue(frame.value);
        if (frame.done) return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [text, delayMs, lettersPerSecond, refreshMs, reduce]);

  return (
    <Tag className={className} aria-label={text} {...rest}>
      <span aria-hidden="true">{value}</span>
    </Tag>
  );
};
