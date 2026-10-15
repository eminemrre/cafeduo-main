/**
 * Decode-frame math for the matrix-style reveal used by loading and waiting
 * labels. Pure: the component owns the clock, so this can be unit tested
 * without a browser or timers.
 *
 * Shape of the reveal: characters resolve left to right while a short tail of
 * random printable characters chases the resolved prefix; the tail is dropped
 * once it has travelled past the end. Values follow the motion study:
 * 40 characters per second, at most 5 random characters, 15 redraws per second.
 */

export interface DecodeFrameOptions {
  /** Characters resolved per second of elapsed time. */
  lettersPerSecond?: number;
  /** How many random characters chase the resolved prefix. */
  maxRandomChars?: number;
  /** Random source in [0, 1); injectable so tests stay deterministic. */
  random?: () => number;
}

export interface DecodeFrame {
  /** Text to paint for this frame. */
  value: string;
  /** True once the tail is past the end and `value` is the target text. */
  done: boolean;
}

export const DEFAULT_LETTERS_PER_SECOND = 40;
export const DEFAULT_MAX_RANDOM_CHARS = 5;

/** Redraw interval in ms (15 fps): slower than the display so the noise reads as text. */
export const DEFAULT_REFRESH_MS = 1000 / 15;

/** Printable ASCII range: '!' (33) to '}' (125). */
const ASCII_PRINTABLE_START = 33;
const ASCII_PRINTABLE_RANGE = 93;

export const decodeFrame = (
  text: string,
  elapsedMs: number,
  options: DecodeFrameOptions = {}
): DecodeFrame => {
  const lettersPerSecond = options.lettersPerSecond ?? DEFAULT_LETTERS_PER_SECOND;
  const maxRandomChars = options.maxRandomChars ?? DEFAULT_MAX_RANDOM_CHARS;
  const random = options.random ?? Math.random;

  const revealed = Math.max(0, Math.floor((lettersPerSecond * elapsedMs) / 1000));
  const fixedCount = Math.min(text.length, Math.max(0, revealed - maxRandomChars));
  const visibleCount = Math.min(text.length, revealed);

  let tail = '';
  for (let index = fixedCount; index < visibleCount; index += 1) {
    tail += String.fromCharCode(
      ASCII_PRINTABLE_START + Math.floor(random() * ASCII_PRINTABLE_RANGE)
    );
  }

  return {
    value: text.slice(0, fixedCount) + tail,
    done: revealed >= text.length + maxRandomChars,
  };
};
