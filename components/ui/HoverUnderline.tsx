/**
 * HoverUnderline — link underline that draws in on hover and retracts on
 * leave. The path carries a slight arc so it reads as printed ink rather than
 * a CSS border, matching the Riso Kantin look.
 *
 * Decorative only: the SVG is aria-hidden and the link keeps its own colour
 * transition. prefers-reduced-motion shows the underline statically instead of
 * drawing it.
 */
import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { DURATION, EASE } from '../../lib/motion';

interface HoverUnderlineProps {
  children: React.ReactNode;
  className?: string;
}

export const HoverUnderline: React.FC<HoverUnderlineProps> = ({ children, className = '' }) => {
  const reduce = useReducedMotion();

  const drawVariants: Variants = reduce
    ? { rest: { pathLength: 1 }, hover: { pathLength: 1 } }
    : {
        rest: { pathLength: 0, opacity: 0 },
        hover: { pathLength: 1, opacity: 1 },
      };

  return (
    <motion.span
      className={`relative inline-block ${className}`}
      initial="rest"
      animate="rest"
      whileHover="hover"
    >
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 -bottom-1 h-[6px] w-full"
      >
        <motion.path
          d="M1 5.6 C 26 3.6, 64 2.8, 99 4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          variants={drawVariants}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  duration: DURATION.base,
                  ease: EASE.brand,
                  opacity: { duration: DURATION.fast },
                }
          }
        />
      </svg>
    </motion.span>
  );
};
