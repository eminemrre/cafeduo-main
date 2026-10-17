import React, { useEffect } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

export interface FloatingSquareFieldProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

type SquareTone = 'pink' | 'blue' | 'mustard';

interface SquareDescriptor {
  tone: SquareTone;
  size: number;
  left: string;
  top: string;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  rotate: number;
  opacity: number;
}

const FLOATING_SQUARES: readonly SquareDescriptor[] = [
  {
    tone: 'pink',
    size: 52,
    left: '5%',
    top: '17%',
    driftX: 20,
    driftY: -14,
    duration: 11,
    delay: 0,
    rotate: -12,
    opacity: 0.86,
  },
  {
    tone: 'mustard',
    size: 68,
    left: '84%',
    top: '22%',
    driftX: -18,
    driftY: 16,
    duration: 14,
    delay: 1.2,
    rotate: 8,
    opacity: 0.82,
  },
  {
    tone: 'blue',
    size: 44,
    left: '13%',
    top: '72%',
    driftX: 16,
    driftY: 12,
    duration: 13,
    delay: 0.8,
    rotate: -3,
    opacity: 0.78,
  },
  {
    tone: 'pink',
    size: 26,
    left: '73%',
    top: '78%',
    driftX: -12,
    driftY: -18,
    duration: 10,
    delay: 2.1,
    rotate: 16,
    opacity: 0.74,
  },
  {
    tone: 'blue',
    size: 20,
    left: '17%',
    top: '36%',
    driftX: 13,
    driftY: -10,
    duration: 12,
    delay: 1.6,
    rotate: 7,
    opacity: 0.68,
  },
  {
    tone: 'mustard',
    size: 32,
    left: '76%',
    top: '47%',
    driftX: -14,
    driftY: 11,
    duration: 15,
    delay: 0.4,
    rotate: -9,
    opacity: 0.7,
  },
  {
    tone: 'pink',
    size: 18,
    left: '42%',
    top: '12%',
    driftX: 10,
    driftY: 14,
    duration: 9,
    delay: 2.8,
    rotate: 22,
    opacity: 0.62,
  },
  {
    tone: 'blue',
    size: 24,
    left: '91%',
    top: '67%',
    driftX: -10,
    driftY: -12,
    duration: 16,
    delay: 1.9,
    rotate: -18,
    opacity: 0.64,
  },
  {
    tone: 'mustard',
    size: 16,
    left: '31%',
    top: '84%',
    driftX: 14,
    driftY: -9,
    duration: 12,
    delay: 3.2,
    rotate: 12,
    opacity: 0.58,
  },
] as const;

const TONE_CLASSES: Record<SquareTone, string> = {
  pink: 'bg-riso-pink',
  blue: 'bg-riso-blue',
  mustard: 'bg-riso-mustard',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const FloatingSquareField: React.FC<FloatingSquareFieldProps> = ({
  containerRef,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 80, damping: 20, mass: 0.35 });
  const springY = useSpring(pointerY, { stiffness: 80, damping: 20, mass: 0.35 });

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined' || !containerRef?.current) return;

    if (window.matchMedia?.('(pointer: coarse)').matches) return;

    const element = containerRef.current;
    const handlePointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const normalizedX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const normalizedY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);

      pointerX.set(normalizedX * 8);
      pointerY.set(normalizedY * 8);
    };
    const resetPointer = () => {
      pointerX.set(0);
      pointerY.set(0);
    };

    element.addEventListener('pointermove', handlePointerMove, { passive: true });
    element.addEventListener('pointerleave', resetPointer);

    return () => {
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerleave', resetPointer);
    };
  }, [containerRef, pointerX, pointerY, reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 will-change-transform"
        style={{ x: springX, y: springY }}
      >
        {FLOATING_SQUARES.map((square, index) => {
          const motionProps = reducedMotion
            ? {}
            : {
                initial: { x: 0, y: 0, rotate: square.rotate },
                animate: {
                  x: [0, square.driftX, 0],
                  y: [0, square.driftY, 0],
                  rotate: [square.rotate, square.rotate + 5, square.rotate],
                },
                transition: {
                  duration: square.duration,
                  delay: square.delay,
                  repeat: Infinity,
                  repeatType: 'mirror' as const,
                  ease: 'easeInOut' as const,
                },
              };

          return (
            <motion.div
              key={`${square.tone}-${index}`}
              data-testid="hero-floating-square"
              data-motion-active={reducedMotion ? undefined : 'true'}
              aria-hidden="true"
              className={`absolute border-2 border-carbon ${TONE_CLASSES[square.tone]} will-change-transform`}
              style={{
                left: square.left,
                top: square.top,
                width: square.size,
                height: square.size,
                opacity: square.opacity,
              }}
              {...motionProps}
            />
          );
        })}
      </motion.div>
    </div>
  );
};
