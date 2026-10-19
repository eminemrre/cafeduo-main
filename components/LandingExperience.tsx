import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * Motion for the public pages (/ and /kafeler). There is no motion toggle: the
 * system's reduced-motion preference decides (DESIGN.md, Motion), and a hidden
 * tab stops everything until it is visible again.
 */
interface LandingMotionState {
  enabled: boolean;
  running: boolean;
  reduced: boolean;
}
const LandingMotionContext = createContext<LandingMotionState | null>(null);

export const useLandingMotion = () => useContext(LandingMotionContext);

export const LandingExperience: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const enabled = !reduced;
  const running = enabled && visible;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMedia = () => setReduced(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMedia();
    syncVisibility();
    media.addEventListener('change', syncMedia);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      media.removeEventListener('change', syncMedia);
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
    return () => observer?.disconnect();
  }, [running]);

  return (
    <LandingMotionContext.Provider value={{ enabled, running, reduced }}>
      <div ref={root} className="cdl-page" data-motion={running ? 'on' : 'off'}>
        {children}
      </div>
    </LandingMotionContext.Provider>
  );
};
