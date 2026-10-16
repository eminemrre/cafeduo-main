import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Gift } from 'lucide-react';
import type { CafeScene } from '../lib/createCafeScene';
import { useLandingMotion } from './LandingExperience';
import { clamp } from '../lib/landingMotion';

export const CafeScene3D: React.FC = () => {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<CafeScene | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const motion = useLandingMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState(0);
  const drag = useRef<{ id: number; startX: number } | null>(null);
  const running = !!motion?.running && inView;
  const touchFirst = !motion?.finePointer;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setInView(visible);
      },
      { rootMargin: '100px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const lost = () => setReady(false);
    element?.addEventListener('webglcontextlost', lost);
    return () => {
      element?.removeEventListener('webglcontextlost', lost);
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    if (!inView || controller.current) return;
    let cancelled = false;
    import('../lib/createCafeScene')
      .then(({ createCafeScene }) => {
        if (cancelled || !canvas.current) return;
        const scene = createCafeScene(canvas.current);
        controller.current = scene;
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver.current = new ResizeObserver(() => scene.resize());
          resizeObserver.current.observe(canvas.current);
        }
        setReady(true);
      })
      .catch(() => {
        /* Decorative scene is optional; the local illustration remains visible. */
      });
    return () => {
      // A slow module load must not create a GPU scene after scrolling away or navigating.
      // An existing scene stays allocated until unmount and simply pauses offscreen.
      cancelled = true;
    };
  }, [inView]);

  useEffect(() => {
    controller.current?.setRunning(running && ready);
  }, [running, ready]);
  useEffect(() => {
    if (ready) controller.current?.setChapter(chapter);
  }, [chapter, ready]);

  // Without a hover pointer the scene turns with the scroll instead, so phones still see depth.
  useEffect(() => {
    const element = host.current;
    if (!element || !running || !ready || !touchFirst) return;
    let frame = 0;
    const sway = () => {
      frame = 0;
      if (drag.current) return;
      const rect = element.getBoundingClientRect();
      const offset = clamp(
        (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight,
        -0.6,
        0.6
      );
      controller.current?.setPointer(offset * 1.6, offset * 0.8);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sway);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
    };
  }, [running, ready, touchFirst]);

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    controller.current?.setPointer(0, 0);
  };

  return (
    <div className="cafe-scene-wrap">
      <div
        ref={host}
        className="cafe-scene"
        data-renderer={ready ? 'webgl' : 'illustration'}
        data-running={running && ready ? 'true' : 'false'}
        onPointerDown={(event) => {
          if (!running || event.pointerType === 'mouse') return;
          drag.current = { id: event.pointerId, startX: event.clientX };
        }}
        onPointerMove={(event) => {
          if (!running) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.pointerType !== 'mouse') {
            // touch-action: pan-y leaves horizontal drags to us, so a sideways swipe spins the scene.
            if (drag.current?.id !== event.pointerId) return;
            const spin = clamp(((event.clientX - drag.current.startX) / rect.width) * 5, -3, 3);
            controller.current?.setPointer(spin, 0);
            return;
          }
          controller.current?.setPointer(
            (event.clientX - rect.left) / rect.width - 0.5,
            (event.clientY - rect.top) / rect.height - 0.5
          );
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') controller.current?.setPointer(0, 0);
        }}
      >
        <div className="cafe-scene-backdrop" aria-hidden="true" />
        <div className="cafe-scene-fallback" aria-hidden="true">
          <span className="cafe-ceramic-cup">
            <i />
          </span>
          <span className="cafe-pink-knight">♞</span>
          <span className="cafe-blue-token">CD</span>
        </div>
        <canvas ref={canvas} className="cafe-scene-canvas" aria-hidden="true" />
      </div>
      <div className="cafe-scene-chapters" aria-label="CafeDuo deneyimi">
        {['Kahveni al', 'Oyuna katıl', 'Ödülünü seç'].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={chapter === index}
            aria-label={label}
            onClick={() => setChapter(index)}
            className="riso-focus"
          >
            {index === 0 ? (
              <Coffee size={19} aria-hidden="true" />
            ) : index === 1 ? (
              <span aria-hidden="true">♞</span>
            ) : (
              <Gift size={19} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
