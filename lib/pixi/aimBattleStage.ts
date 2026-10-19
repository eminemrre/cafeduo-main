/**
 * Aim Battle PixiJS stage
 *
 * Pure-presentational PixiJS v8 layer for the Nişancı Düellosu game. Game
 * logic and state stay in React/ArenaBattle.tsx; this module exposes a
 * minimal imperative API:
 *
 *   const stage = await createAimBattleStage(canvas);
 *   stage.setReticleX(gauge);     // 0..100, follows the bouncing sight
 *   stage.flash('hit3');          // burst + ripple at reticle position
 *   stage.showScorePopup('+3');
 *   stage.destroy();
 *
 * Why imperative instead of React-render-cycle bound: PixiJS owns its own
 * render loop and animating via React state would force a re-render per
 * frame. The component mounts the canvas once and pushes property updates.
 *
 * Note: NOT covered by automated tests because PixiJS v8 requires WebGL
 * which jsdom doesn't expose. ArenaBattle.tsx tests mock this module out.
 */

import { Application, Container, Graphics, Text, Ticker } from 'pixi.js';

export type HitTier = 'miss' | 'hit1' | 'hit2' | 'hit3';

// DESIGN.md palette: danger for a miss, then limon, gök and the game's own lokum.
const TIER_COLORS: Record<HitTier, number> = {
  miss: 0xd62f2f, // danger — fail
  hit1: 0xffd23f, // limon — graze
  hit2: 0x1fb3ff, // gök — clean
  hit3: 0xff5c8a, // lokum — bullseye
};
const INK = 0x17140f;

const TIER_PARTICLE_COUNT: Record<HitTier, number> = {
  miss: 6,
  hit1: 10,
  hit2: 16,
  hit3: 24,
};

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number; // 1.0 -> 0.0
  decay: number;
}

interface ScorePopup {
  text: Text;
  vy: number;
  life: number;
}

export interface AimBattleStage {
  setReticleX(percent: number): void;
  flash(tier: HitTier): void;
  showScorePopup(label: string, tier: HitTier): void;
  setActive(active: boolean): void; // pause/resume render loop
  destroy(): void;
}

/**
 * Create the stage. Caller owns the canvas; we mount onto it.
 *
 * @param canvas — the target <canvas> element (sized by parent CSS)
 */
export const createAimBattleStage = async (canvas: HTMLCanvasElement): Promise<AimBattleStage> => {
  const app = new Application();

  // resizeTo: the canvas wrapper; we don't pass width/height so the
  // ResizePlugin tracks the canvas size and updates app.screen.
  await app.init({
    canvas,
    background: 'transparent',
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: canvas.parentElement || undefined,
    preference: 'webgl', // safer fallback across older devices; WebGPU still picks if browser supports
  });

  // === Layer setup ===
  const bgLayer = new Container();
  const reticleLayer = new Container();
  const particleLayer = new Container();
  const popupLayer = new Container();
  app.stage.addChild(bgLayer, reticleLayer, particleLayer, popupLayer);

  // === Background grid (subtle) ===
  const gridGraphics = new Graphics();
  const drawGrid = (): void => {
    gridGraphics.clear();
    const w = app.screen.width;
    const h = app.screen.height;
    // The ice ground stays plain (no grid); only the centre the player aims for is drawn.
    const cx = w / 2;
    gridGraphics.moveTo(cx, 0).lineTo(cx, h).stroke({ width: 2, color: INK, alpha: 0.3 });
  };
  drawGrid();
  bgLayer.addChild(gridGraphics);

  // === Reticle ===
  const reticle = new Graphics();
  const drawReticle = (): void => {
    reticle.clear();
    // Outer ring
    reticle.circle(0, 0, 28).stroke({ width: 3, color: INK, alpha: 1 });
    // Inner crosshair lines
    reticle
      .moveTo(-18, 0)
      .lineTo(-8, 0)
      .moveTo(8, 0)
      .lineTo(18, 0)
      .moveTo(0, -18)
      .lineTo(0, -8)
      .moveTo(0, 8)
      .lineTo(0, 18)
      .stroke({ width: 3, color: INK, alpha: 1 });
    // Center dot in the game's colour
    reticle.circle(0, 0, 3.5).fill(0xff5c8a);
  };
  drawReticle();
  reticle.y = 0; // y set on first frame from screen height
  reticleLayer.addChild(reticle);

  // === State ===
  let reticlePercent = 50;
  let active = true;
  let pulsePhase = 0;
  const particles: Particle[] = [];
  const popups: ScorePopup[] = [];

  // === Tick: drive reticle + particle + popup animations ===
  const ticker = app.ticker;
  const tickerFn = (t: Ticker): void => {
    if (!active) return;

    // Reticle position from prop
    reticle.x = (reticlePercent / 100) * app.screen.width;
    reticle.y = app.screen.height / 2;

    // Gentle pulse on reticle scale
    pulsePhase += 0.04 * t.deltaTime;
    const pulseScale = 1 + Math.sin(pulsePhase) * 0.06;
    reticle.scale.set(pulseScale);

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.g.x += p.vx * t.deltaTime;
      p.g.y += p.vy * t.deltaTime;
      p.vy += 0.18 * t.deltaTime; // gravity
      p.life -= p.decay * t.deltaTime;
      p.g.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        particleLayer.removeChild(p.g);
        p.g.destroy();
        particles.splice(i, 1);
      }
    }

    // Score popups
    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.text.y += pop.vy * t.deltaTime;
      pop.vy *= 0.96;
      pop.life -= 0.018 * t.deltaTime;
      pop.text.alpha = Math.max(0, pop.life);
      if (pop.life <= 0) {
        popupLayer.removeChild(pop.text);
        pop.text.destroy();
        popups.splice(i, 1);
      }
    }
  };
  ticker.add(tickerFn);

  // === Resize hook: redraw the grid + clamp reticle position ===
  const onResize = (): void => drawGrid();
  app.renderer.on('resize', onResize);

  // === API ===
  const setReticleX = (percent: number): void => {
    reticlePercent = Math.max(0, Math.min(100, percent));
  };

  const flash = (tier: HitTier): void => {
    const color = TIER_COLORS[tier];
    const count = TIER_PARTICLE_COUNT[tier];
    const cx = reticle.x;
    const cy = reticle.y;

    // Ring ripple
    const ripple = new Graphics();
    ripple.circle(0, 0, 4).stroke({ width: 3, color, alpha: 0.9 });
    ripple.x = cx;
    ripple.y = cy;
    particleLayer.addChild(ripple);
    let ripplePhase = 0;
    const rippleFn = (t: Ticker): void => {
      ripplePhase += t.deltaTime;
      const r = 4 + ripplePhase * 3.2;
      ripple
        .clear()
        .circle(0, 0, r)
        .stroke({
          width: Math.max(0.5, 3 - ripplePhase * 0.1),
          color,
          alpha: Math.max(0, 0.9 - ripplePhase * 0.04),
        });
      if (ripplePhase > 22) {
        ticker.remove(rippleFn);
        particleLayer.removeChild(ripple);
        ripple.destroy();
      }
    };
    ticker.add(rippleFn);

    // Burst particles
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2 + Math.random() * 3.5;
      const g = new Graphics();
      g.circle(0, 0, 2 + Math.random() * 1.5).fill(color);
      g.x = cx;
      g.y = cy;
      particleLayer.addChild(g);
      particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.015,
      });
    }
  };

  const showScorePopup = (label: string, tier: HitTier): void => {
    const text = new Text({
      text: label,
      style: {
        fontFamily: 'Onest, system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '700',
        fill: tier === 'miss' ? 0xb8241a : INK,
      },
    });
    text.anchor.set(0.5);
    text.x = reticle.x;
    text.y = reticle.y - 36;
    popupLayer.addChild(text);
    popups.push({ text, vy: -1.6, life: 1.0 });
  };

  const setActive = (next: boolean): void => {
    active = next;
  };

  const destroy = (): void => {
    ticker.remove(tickerFn);
    app.renderer.off('resize', onResize);
    // Release particles + popups before app.destroy disposes the stage
    particles.length = 0;
    popups.length = 0;
    app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
  };

  return { setReticleX, flash, showScorePopup, setActive, destroy };
};
