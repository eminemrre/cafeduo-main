/**
 * Knowledge Quiz PixiJS stage
 *
 * Pure-presentational layer for the Bilgi Yarışı game. Lives ON TOP of the
 * question card's existing CSS feedback (`animate-flash-green/red`,
 * `animate-shake`, `animate-float-up`) and enriches it with particle
 * bursts. Game logic stays in React; this stage exposes:
 *
 *   const stage = await createQuizStage(canvas);
 *   stage.playCorrect();   // green/cyan/gold confetti from center
 *   stage.playWrong();     // red/orange scatter (shatter feel)
 *   stage.playFinale();    // larger multi-color celebration
 *   stage.setActive(false);
 *   stage.destroy();
 *
 * Not unit-tested (WebGL unavailable in jsdom); KnowledgeQuiz.test.tsx
 * mocks the React wrapper out, same pattern as
 * ChessBoardOverlay.
 */

import { Application, Container, Graphics, Ticker } from 'pixi.js';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  spin: number; // angular velocity for confetti tumble
  rot: number;
}

export interface QuizStage {
  playCorrect(): void;
  playWrong(): void;
  playFinale(): void;
  setActive(active: boolean): void;
  destroy(): void;
}

export const createQuizStage = async (canvas: HTMLCanvasElement): Promise<QuizStage> => {
  const app = new Application();

  await app.init({
    canvas,
    background: 'transparent',
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: canvas.parentElement || undefined,
    preference: 'webgl',
  });

  const particleLayer = new Container();
  app.stage.addChild(particleLayer);

  let active = true;
  const particles: Particle[] = [];

  /**
   * Spawn a circular burst at (cx, cy) — same primitive used by the aim and
   * chess stages; kept module-local so each stage stays self-contained.
   */
  const burst = (
    cx: number,
    cy: number,
    color: number,
    count: number,
    speed: number,
    shape: 'circle' | 'confetti' = 'circle'
  ): void => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const v = speed * (0.55 + Math.random() * 0.7);
      const g = new Graphics();
      if (shape === 'confetti') {
        // Small rectangle that tumbles — feels more festive than dots
        const w = 4 + Math.random() * 3;
        const h = 6 + Math.random() * 4;
        g.rect(-w / 2, -h / 2, w, h).fill(color);
      } else {
        g.circle(0, 0, 2.2 + Math.random() * 1.6).fill(color);
      }
      g.x = cx;
      g.y = cy;
      g.rotation = Math.random() * Math.PI * 2;
      particleLayer.addChild(g);
      particles.push({
        g,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1.4,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.012,
        spin: (Math.random() - 0.5) * 0.35,
        rot: g.rotation,
      });
    }
  };

  const center = (): { x: number; y: number } => ({
    x: app.screen.width / 2,
    y: app.screen.height / 2,
  });

  const playCorrect = (): void => {
    const { x, y } = center();
    // Layered burst: green core, cyan mid, gold rim — confetti shape
    burst(x, y, 0xb6d31b, 18, 4.5, 'confetti');
    burst(x, y, 0x1fb3ff, 10, 3.6, 'confetti');
    burst(x, y, 0xffd23f, 8, 3.0, 'circle');
  };

  const playWrong = (): void => {
    const { x, y } = center();
    // Faster, harsher scatter — more red than orange
    burst(x, y, 0xd62f2f, 14, 5.0, 'circle');
    burst(x, y, 0xff5c8a, 8, 4.0, 'circle');
  };

  const playFinale = (): void => {
    const { x, y } = center();
    // Multi-wave celebration (mirrors PR #21's checkmate energy)
    burst(x, y, 0xb6d31b, 30, 5.2, 'confetti');
    burst(x, y, 0x1fb3ff, 20, 4.4, 'confetti');
    burst(x, y, 0xffd23f, 16, 3.8, 'confetti');
    burst(x, y, 0xff5c8a, 12, 3.4, 'confetti'); // lokum accent
  };

  // === Tick: drive decay loop ===
  const ticker = app.ticker;
  const tickerFn = (t: Ticker): void => {
    if (!active) return;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.g.x += p.vx * t.deltaTime;
      p.g.y += p.vy * t.deltaTime;
      p.vy += 0.22 * t.deltaTime; // gravity
      p.rot += p.spin * t.deltaTime;
      p.g.rotation = p.rot;
      p.life -= p.decay * t.deltaTime;
      p.g.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        particleLayer.removeChild(p.g);
        p.g.destroy();
        particles.splice(i, 1);
      }
    }
  };
  ticker.add(tickerFn);

  const setActive = (next: boolean): void => {
    active = next;
  };

  const destroy = (): void => {
    ticker.remove(tickerFn);
    particles.length = 0;
    app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
  };

  return { playCorrect, playWrong, playFinale, setActive, destroy };
};
