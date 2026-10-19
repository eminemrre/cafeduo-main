/**
 * Retro Chess board PixiJS stage
 *
 * Pure-presentational layer overlaid on top of the CSS 8x8 grid in
 * `RetroChess.tsx`. Game logic stays in React; this stage renders:
 *
 *   - Last-move trail (from→to fading line)
 *   - Capture explosion (particle burst at captured square)
 *   - Check pulse ring (animated red ring on the king's square)
 *   - Checkmate finale (larger gold burst)
 *
 * The board's pixel size is provided by the React wrapper via setBoardSize.
 * Square coordinates accept algebraic notation ('a1'..'h8'); we convert to
 * pixel centers based on the current orientation.
 *
 * Not unit-tested (WebGL unavailable in jsdom); the RetroChess.tsx test
 * file mocks the React wrapper out, same pattern as AimBattleStageCanvas.
 */

import { Application, Container, Graphics, Ticker } from 'pixi.js';

export type Orientation = 'w' | 'b';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  decay: number;
}

interface TrailLine {
  g: Graphics;
  life: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface ChessBoardStage {
  setBoardSize(width: number, height: number): void;
  setOrientation(o: Orientation): void;
  setLastMove(from: string | null, to: string | null): void;
  setCheckSquare(square: string | null): void;
  playCapture(square: string): void;
  playCheckmate(square: string): void;
  setActive(active: boolean): void;
  destroy(): void;
}

const FILE_INDEX: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  f: 5,
  g: 6,
  h: 7,
};

/** algebraic 'e4' → { file: 4, rank: 3 } (0-based, white-bottom) */
const parseSquare = (sq: string): { file: number; rank: number } | null => {
  if (!sq || sq.length < 2) return null;
  const file = FILE_INDEX[sq[0]?.toLowerCase() ?? ''];
  const rank = parseInt(sq[1] ?? '', 10) - 1;
  if (file === undefined || Number.isNaN(rank) || rank < 0 || rank > 7) return null;
  return { file, rank };
};

export const createChessBoardStage = async (
  canvas: HTMLCanvasElement
): Promise<ChessBoardStage> => {
  const app = new Application();

  await app.init({
    canvas,
    background: 'transparent',
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });

  const trailLayer = new Container();
  const checkLayer = new Container();
  const particleLayer = new Container();
  app.stage.addChild(trailLayer, checkLayer, particleLayer);

  // === State ===
  let boardWidth = canvas.parentElement?.clientWidth || 320;
  let boardHeight = canvas.parentElement?.clientHeight || 320;
  let orientation: Orientation = 'w';
  let checkSquare: string | null = null;
  let active = true;
  let checkPhase = 0;
  const particles: Particle[] = [];
  const trails: TrailLine[] = [];

  // Pre-allocate the check ring; we move + redraw it per frame
  const checkRing = new Graphics();
  checkLayer.addChild(checkRing);
  checkRing.visible = false;

  // === Coordinate helpers ===
  const squareSize = (): number => Math.min(boardWidth, boardHeight) / 8;

  const squareCenter = (sq: string): { x: number; y: number } | null => {
    const parsed = parseSquare(sq);
    if (!parsed) return null;
    const size = squareSize();
    // White at bottom: rank 0 (1st rank) is at the bottom → y = (7-rank)*size + size/2
    // When orientation is 'b', flip both axes
    let fileIdx = parsed.file;
    let rankIdx = parsed.rank;
    if (orientation === 'b') {
      fileIdx = 7 - fileIdx;
      rankIdx = 7 - rankIdx;
    }
    const x = fileIdx * size + size / 2;
    const y = (7 - rankIdx) * size + size / 2;
    return { x, y };
  };

  // === Effects ===
  const burst = (cx: number, cy: number, color: number, count: number, speed: number): void => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = speed * (0.6 + Math.random() * 0.6);
      const g = new Graphics();
      g.circle(0, 0, 2.5 + Math.random() * 1.8).fill(color);
      g.x = cx;
      g.y = cy;
      particleLayer.addChild(g);
      particles.push({
        g,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1.2,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.015,
      });
    }
  };

  const playCapture = (square: string): void => {
    const c = squareCenter(square);
    if (!c) return;
    // Crimson + orange double burst — feels like a clash
    burst(c.x, c.y, 0xd62f2f, 14, 3.5);
    burst(c.x, c.y, 0xffd23f, 8, 2.8);
  };

  const playCheckmate = (square: string): void => {
    const c = squareCenter(square);
    if (!c) return;
    // Larger gold celebration
    burst(c.x, c.y, 0xffd23f, 30, 4.5);
    burst(c.x, c.y, 0xb6d31b, 18, 3.2);
    burst(c.x, c.y, 0x1fb3ff, 14, 2.4);
  };

  const setLastMove = (from: string | null, to: string | null): void => {
    if (!from || !to) return;
    const a = squareCenter(from);
    const b = squareCenter(to);
    if (!a || !b) return;
    const g = new Graphics();
    trailLayer.addChild(g);
    trails.push({ g, life: 1.0, fromX: a.x, fromY: a.y, toX: b.x, toY: b.y });
  };

  // === Tick ===
  const ticker = app.ticker;
  const tickerFn = (t: Ticker): void => {
    if (!active) return;

    // Check ring pulse
    if (checkSquare) {
      const c = squareCenter(checkSquare);
      if (c) {
        checkPhase += 0.08 * t.deltaTime;
        const size = squareSize();
        const baseR = size * 0.45;
        const pulse = baseR + Math.sin(checkPhase) * 4;
        checkRing.visible = true;
        checkRing.x = c.x;
        checkRing.y = c.y;
        checkRing
          .clear()
          .circle(0, 0, pulse)
          .stroke({ width: 3, color: 0xd62f2f, alpha: 0.85 })
          .circle(0, 0, pulse - 4)
          .stroke({ width: 1.5, color: 0xff5c8a, alpha: 0.5 });
      } else {
        checkRing.visible = false;
      }
    } else {
      checkRing.visible = false;
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.g.x += p.vx * t.deltaTime;
      p.g.y += p.vy * t.deltaTime;
      p.vy += 0.2 * t.deltaTime;
      p.life -= p.decay * t.deltaTime;
      p.g.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        particleLayer.removeChild(p.g);
        p.g.destroy();
        particles.splice(i, 1);
      }
    }

    // Trail fade
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i];
      tr.life -= 0.012 * t.deltaTime;
      tr.g
        .clear()
        .moveTo(tr.fromX, tr.fromY)
        .lineTo(tr.toX, tr.toY)
        .stroke({ width: 4, color: 0xffd23f, alpha: Math.max(0, tr.life * 0.75) });
      if (tr.life <= 0) {
        trailLayer.removeChild(tr.g);
        tr.g.destroy();
        trails.splice(i, 1);
      }
    }
  };
  ticker.add(tickerFn);

  // === API ===
  const setBoardSize = (w: number, h: number): void => {
    boardWidth = Math.max(1, w);
    boardHeight = Math.max(1, h);
    app.renderer.resize(boardWidth, boardHeight);
  };

  const setOrientation = (o: Orientation): void => {
    orientation = o;
  };

  const setCheckSquare = (sq: string | null): void => {
    checkSquare = sq;
  };

  const setActive = (next: boolean): void => {
    active = next;
  };

  const destroy = (): void => {
    ticker.remove(tickerFn);
    particles.length = 0;
    trails.length = 0;
    app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
  };

  // Initial resize after init
  setBoardSize(boardWidth, boardHeight);

  return {
    setBoardSize,
    setOrientation,
    setLastMove,
    setCheckSquare,
    playCapture,
    playCheckmate,
    setActive,
    destroy,
  };
};
