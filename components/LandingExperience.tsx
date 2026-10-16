import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { createLandingMotion } from '../lib/landingMotion';

interface LandingMotionState {
  enabled: boolean;
  running: boolean;
  reduced: boolean;
  finePointer: boolean;
  toggle: () => void;
}
const LandingMotionContext = createContext<LandingMotionState | null>(null);
const MOTION_PREFERENCE = 'cafeduo_landing_motion';
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

export const useLandingMotion = () => useContext(LandingMotionContext);

export const LandingMotionControl: React.FC = () => {
  const motion = useContext(LandingMotionContext);
  if (!motion) return null;
  return (
    <button
      type="button"
      className="club-motion-control riso-focus"
      onClick={motion.toggle}
      aria-pressed={motion.enabled}
      aria-label={
        motion.reduced ? 'Hareket azaltıldı' : motion.enabled ? 'Hareketi durdur' : 'Hareketi aç'
      }
      disabled={motion.reduced}
    >
      {motion.enabled ? (
        <Pause size={16} aria-hidden="true" />
      ) : (
        <Play size={16} aria-hidden="true" />
      )}
    </button>
  );
};

export const LandingExperience: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const inkLayer = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  const [finePointer, setFinePointer] = useState(false);
  const [preferred, setPreferred] = useState(true);
  const [visible, setVisible] = useState(true);
  const enabled = preferred && !reduced;
  const running = enabled && visible;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerMedia = window.matchMedia(FINE_POINTER);
    const syncMedia = () => {
      setReduced(media.matches);
      setFinePointer(pointerMedia.matches);
    };
    const syncVisibility = () => setVisible(!document.hidden);
    syncMedia();
    syncVisibility();
    try {
      setPreferred(sessionStorage.getItem(MOTION_PREFERENCE) !== 'off');
    } catch {
      /* Storage is optional. */
    }
    media.addEventListener('change', syncMedia);
    pointerMedia.addEventListener('change', syncMedia);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      media.removeEventListener('change', syncMedia);
      pointerMedia.removeEventListener('change', syncMedia);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.landingMotion = enabled ? 'on' : 'off';
    return () => {
      delete document.documentElement.dataset.landingMotion;
    };
  }, [enabled]);

  useEffect(() => {
    const element = root.current;
    if (!element || !running) return;
    const targets = element.querySelectorAll<HTMLElement>('[data-landing-reveal]');
    // Content stays visible before enhancement and when IntersectionObserver is unavailable.
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  (entry.target as HTMLElement).dataset.landingRevealed = 'true';
                  observer?.unobserve(entry.target);
                }
              }
            },
            { threshold: 0.12 }
          );
    targets.forEach((target) => observer?.observe(target));
    const stopEngine = createLandingMotion(element, {
      finePointer,
      cursor: cursor.current,
      inkLayer: inkLayer.current,
    });
    return () => {
      observer?.disconnect();
      stopEngine();
    };
  }, [running, finePointer]);

  const toggle = () => {
    const next = !preferred;
    setPreferred(next);
    try {
      sessionStorage.setItem(MOTION_PREFERENCE, next ? 'on' : 'off');
    } catch {
      /* Storage is optional. */
    }
  };

  return (
    <LandingMotionContext.Provider value={{ enabled, running, reduced, finePointer, toggle }}>
      <div ref={root} className="club-landing" data-motion={running ? 'on' : 'off'}>
        <div className="club-reading-progress" aria-hidden="true" />
        {children}
        <div ref={inkLayer} className="club-ink-layer" aria-hidden="true" />
        {finePointer && enabled && (
          <div
            ref={cursor}
            className="club-cursor"
            data-state="idle"
            data-visible="false"
            aria-hidden="true"
          >
            <span />
          </div>
        )}
      </div>
    </LandingMotionContext.Provider>
  );
};
