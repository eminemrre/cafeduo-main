/**
 * useTilt — kartı imlece doğru eğen 3D tilt (rotateX/rotateY) hook'u.
 *
 * CyberMascot.tsx'teki mouse-spring desenine dayanır (useSpring + pointermove
 * + rAF throttle + getBoundingClientRect). Çift kapatma gate'i:
 *   - useReducedMotion() (hareketi azalt)
 *   - matchMedia('(hover: hover) and (pointer: fine)') (touch/coarse pointer)
 * Kapalıysa listener bağlanmaz, rotateX/rotateY 0 kalır (no-op).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion, useSpring, type MotionValue } from 'framer-motion';

interface UseTiltOptions {
  /** Maksimum eğilme açısı (derece). */
  max?: number;
  stiffness?: number;
  damping?: number;
}

interface UseTiltResult {
  ref: RefObject<HTMLDivElement | null>;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  enabled: boolean;
}

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

export function useTilt({
  max = 7,
  stiffness = 150,
  damping = 18,
}: UseTiltOptions = {}): UseTiltResult {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const finePointer =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(FINE_POINTER).matches
      : false;
  const enabled = !reduce && finePointer;

  const rotateX = useSpring(0, { stiffness, damping });
  const rotateY = useSpring(0, { stiffness, damping });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;

    const apply = () => {
      rafRef.current = null;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return; // jsdom / gizli eleman koruması
      const px = (lastRef.current.x - rect.left) / rect.width - 0.5; // -0.5..0.5
      const py = (lastRef.current.y - rect.top) / rect.height - 0.5;
      rotateY.set(px * max * 2);
      rotateX.set(-py * max * 2);
    };

    const onMove = (event: PointerEvent) => {
      lastRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(apply);
      }
    };

    const onLeave = () => {
      rotateX.set(0);
      rotateY.set(0);
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, max, rotateX, rotateY]);

  return { ref, rotateX, rotateY, enabled };
}
