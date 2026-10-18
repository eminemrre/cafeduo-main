import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createLandingMotion } from '../lib/landingMotion';

interface LandingMotionState {
  enabled: boolean;
  running: boolean;
  reduced: boolean;
  finePointer: boolean;
}
const LandingMotionContext = createContext<LandingMotionState | null>(null);
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

export const useLandingMotion = () => useContext(LandingMotionContext);

export const LandingExperience: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const inkLayer = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  const [finePointer, setFinePointer] = useState(false);
  const [visible, setVisible] = useState(true);
  // Motion is part of the landing design and always on; only the system-wide
  // reduced-motion setting turns it off, because that is an accessibility need.
  const enabled = !reduced;
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

  return (
    <LandingMotionContext.Provider value={{ enabled, running, reduced, finePointer }}>
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
