import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface LandingMotionState {
  enabled: boolean;
  reduced: boolean;
  toggle: () => void;
}
const LandingMotionContext = createContext<LandingMotionState | null>(null);
const MOTION_PREFERENCE = 'cafeduo_landing_motion';

export const LandingMotionControl: React.FC = () => {
  const motion = useContext(LandingMotionContext);
  if (!motion) return null;
  return (
    <button
      type="button"
      className="club-motion-control riso-focus"
      onClick={motion.toggle}
      aria-pressed={motion.enabled}
      disabled={motion.reduced}
      title={motion.reduced ? 'Cihazının azaltılmış hareket tercihi uygulanıyor.' : undefined}
    >
      <span aria-hidden="true">{motion.enabled ? 'Ⅱ' : '▷'}</span>
      {motion.reduced ? 'Hareket azaltıldı' : motion.enabled ? 'Hareketi durdur' : 'Hareketi aç'}
    </button>
  );
};

export const LandingExperience: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true);
  const [preferred, setPreferred] = useState(true);
  const [visible, setVisible] = useState(true);
  const enabled = preferred && !reduced;
  const running = enabled && visible;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMedia = () => setReduced(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMedia();
    syncVisibility();
    try {
      setPreferred(sessionStorage.getItem(MOTION_PREFERENCE) !== 'off');
    } catch {
      /* Storage is optional. */
    }
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
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const distance = Math.max(1, element.offsetHeight - window.innerHeight);
      element.style.setProperty(
        '--club-progress',
        String(Math.min(1, Math.max(0, -rect.top / distance)))
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(updateProgress);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [running]);

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
    <LandingMotionContext.Provider value={{ enabled, reduced, toggle }}>
      <div ref={root} className="club-landing" data-motion={running ? 'on' : 'off'}>
        <div className="club-reading-progress" aria-hidden="true" />
        {children}
      </div>
    </LandingMotionContext.Provider>
  );
};
