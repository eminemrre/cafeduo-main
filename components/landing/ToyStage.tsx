/**
 * The hero's live thing: the CafeDuo toy set on the table. Tapping the knight makes it play a
 * knight's move toward the MASA07 tent, and the coin flips to +20. The 3D scene loads only when
 * visible and when WebGL exists; otherwise the same toys are a pre-rendered picture and the move
 * swaps to its end pose.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ToyScene } from '../../lib/createToyScene';
import { useLandingMotion } from '../LandingExperience';
import { toyImage } from './landingContent';

const hasWebGL = () => {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
};

export const ToyStage: React.FC = () => {
  const motion = useLandingMotion();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ToyScene | null>(null);
  const [inView, setInView] = useState(false);
  const [live, setLive] = useState(false);
  const [moved, setMoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = !!motion?.running && inView && live;
  const animated = !!motion?.enabled;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '120px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || scene.current || !canvas.current || !hasWebGL()) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ createToyScene }] = await Promise.all([
          import('../../lib/createToyScene'),
          // The tent and coin labels are drawn with the display face.
          document.fonts
            ? document.fonts.load('100px "Baloo 2"').catch((): FontFace[] => [])
            : Promise.resolve([]),
        ]);
        if (cancelled || !canvas.current || !host.current) return;
        scene.current = createToyScene(canvas.current, {
          field: null,
          layout: 'hero',
          still: !animated,
        });
        const { width, height } = canvas.current.getBoundingClientRect();
        scene.current.resize(width, height);
        setLive(true);
      } catch {
        // The picture stays: WebGL is an enhancement here.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Built once when first visible; motion changes are applied through setRunning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  useEffect(() => {
    scene.current?.setRunning(running);
  }, [running]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !live || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      scene.current?.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [live]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = host.current?.getBoundingClientRect();
      if (rect) scene.current?.setScroll(-rect.top / Math.max(1, rect.height));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
    };
  }, [running]);

  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
    },
    []
  );

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scene.current || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1
    );
  };

  const playMove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (scene.current) await scene.current.playKnightMove();
      setMoved((value) => !value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={host}
      className="cdl-stage"
      data-live={live}
      data-moved={moved}
      onPointerMove={onPointerMove}
      onPointerLeave={() => scene.current?.setPointer(0, 0)}
    >
      <picture className="cdl-stage-still" aria-hidden={live}>
        <source
          media="(max-width: 699px)"
          srcSet={toyImage(moved ? 'hero-wide-moved' : 'hero-tall')}
        />
        <img
          src={toyImage(moved ? 'hero-wide-moved' : 'hero-wide')}
          width={1440}
          height={1520}
          alt={
            moved
              ? 'Oyuncak satranç atı MASA07 tabelasının önüne gelmiş, yeşil jetonda +20 yazıyor'
              : 'Masada oyuncak satranç atı, pembe fincan, 100 yazan yeşil jeton ve MASA07 tabelası'
          }
        />
      </picture>
      <canvas ref={canvas} className="cdl-stage-canvas" aria-hidden="true" />
      <button
        type="button"
        className="cdl-stage-play"
        onClick={() => void playMove()}
        aria-pressed={moved}
        aria-disabled={busy}
      >
        {moved ? 'Atı geri çek' : 'Ata dokun, ilk hamleni yap'}
      </button>
      <p className="cdl-stage-caption" aria-live="polite">
        {moved ? 'Güzel açılış. Gerçek maçta kazandığın puan o kafenin ödüllerine gider.' : ''}
      </p>
    </div>
  );
};
