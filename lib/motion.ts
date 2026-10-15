/**
 * Motion tokens — single source for animation timing in JS and CSS.
 *
 * Curves and the 20 ms stagger step come from the motion study in plan step 17:
 * a fast start with a long settle reads as deliberate without extra frames.
 * The same values exist as CSS custom properties in index.css; motion.test.ts
 * fails when the two drift apart. See docs/motion.md for the full system.
 *
 * Components never hardcode a duration or curve — take them from here or from
 * the --ease-* / --dur-* variables.
 */

export type CubicBezier = [number, number, number, number];

export const EASE = {
  /** House curve: fast start, long settle. Default for entrances. */
  brand: [0.35, 0, 0, 1] as CubicBezier,
  /** Quick settle. Exits and hover feedback. */
  outQuart: [0.25, 1, 0.5, 1] as CubicBezier,
  /** Long even travel. Overlays and full-screen wipes. */
  inOutExpo: [0.87, 0, 0.13, 1] as CubicBezier,
} as const;

/** Seconds, for framer-motion transitions. */
export const DURATION = {
  /** Hover and press feedback. */
  fast: 0.15,
  /** Default for state changes: menus, panels, page transitions. */
  base: 0.3,
  /** Entrances that should feel deliberate. */
  slow: 0.5,
} as const;

/** Per-item delay for staggered lists, in seconds (20 ms). */
export const STAGGER = 0.02;

/** Ready-made transitions for the common framer-motion cases. */
export const TRANSITION = {
  fast: { duration: DURATION.fast, ease: EASE.brand },
  base: { duration: DURATION.base, ease: EASE.brand },
  slow: { duration: DURATION.slow, ease: EASE.brand },
} as const;
