import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Gift } from 'lucide-react';
import type { CafeScene } from '../lib/createCafeScene';
import { useLandingMotion } from './LandingExperience';

export const CafeScene3D: React.FC = () => {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<CafeScene | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const motion = useLandingMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState(0);
  const running = !!motion?.running && inView;

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

  return (
    <div className="cafe-scene-wrap">
      <div
        ref={host}
        className="cafe-scene"
        data-renderer={ready ? 'webgl' : 'illustration'}
        data-running={running && ready ? 'true' : 'false'}
        onPointerMove={(event) => {
          if (!running || event.pointerType === 'touch') return;
          const rect = event.currentTarget.getBoundingClientRect();
          controller.current?.setPointer(
            (event.clientX - rect.left) / rect.width - 0.5,
            (event.clientY - rect.top) / rect.height - 0.5
          );
        }}
        onPointerLeave={() => controller.current?.setPointer(0, 0)}
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
