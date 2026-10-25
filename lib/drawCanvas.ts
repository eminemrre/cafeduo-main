/**
 * Çiz Bil canvas helpers: the shared 1000 × 1000 coordinate space, the
 * palette, batching strokes into packets the server accepts
 * (backend/gameEngine/drawStrokes.js) and replaying them onto a canvas.
 */

export const CANVAS_SIZE = 1000;
export const MAX_OPS_PER_PACKET = 8;
export const MAX_POINTS_PER_PACKET = 128;
/** Points closer than this (in canvas units) to the previous one are dropped. */
const MIN_STEP = 4;

export interface PaletteColor {
  name: string;
  value: string;
  eraser?: boolean;
}

/** Index order is the wire format; the last entry erases. */
export const PALETTE: PaletteColor[] = [
  { name: 'Mürekkep', value: '#17140F' },
  { name: 'Lokum', value: '#FF5C8A' },
  { name: 'Gök', value: '#1FB3FF' },
  { name: 'Limon', value: '#FFD23F' },
  { name: 'Fıstık', value: '#B6D31B' },
  { name: 'Deniz', value: '#2EC4B6' },
  { name: 'Portakal', value: '#FF8A3D' },
  { name: 'Silgi', value: '#FFFFFF', eraser: true },
];

/** Line widths in canvas units. */
export const WIDTHS = [5, 11, 24];

export type StrokePoint = [number, number];
export type StrokeOp = { t: 'line'; id: number; c: number; w: number; p: StrokePoint[] } | { t: 'clear' };

const clamp = (value: number) => Math.max(0, Math.min(CANVAS_SIZE, Math.round(value)));

export const toCanvasPoint = (clientX: number, clientY: number, rect: DOMRect): StrokePoint => [
  clamp(((clientX - rect.left) / rect.width) * CANVAS_SIZE),
  clamp(((clientY - rect.top) / rect.height) * CANVAS_SIZE),
];

/** Collects pointer points and hands out packets within the server limits. */
export const createStrokeBatcher = () => {
  const queue: StrokeOp[] = [];
  let current: { id: number; c: number; w: number; last: StrokePoint | null } | null = null;

  const lineFor = (id: number, c: number, w: number) => {
    const tail = queue[queue.length - 1];
    if (tail && tail.t === 'line' && tail.id === id) return tail;
    const op: StrokeOp = { t: 'line', id, c, w, p: [] };
    queue.push(op);
    return op;
  };

  return {
    begin(id: number, c: number, w: number) {
      current = { id, c, w, last: null };
    },
    /** Adds a point to the current stroke; returns it when kept (for local drawing). */
    add(point: StrokePoint): StrokePoint | null {
      if (!current) return null;
      const { last } = current;
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP) return null;
      current.last = point;
      const op = lineFor(current.id, current.c, current.w);
      if (op.t === 'line') op.p.push(point);
      return point;
    },
    end() {
      current = null;
    },
    clear() {
      current = null;
      queue.push({ t: 'clear' });
    },
    /** The next packet (possibly empty); long strokes are split across packets. */
    flush(): StrokeOp[] {
      const packet: StrokeOp[] = [];
      let budget = MAX_POINTS_PER_PACKET;
      while (queue.length && packet.length < MAX_OPS_PER_PACKET && budget > 0) {
        const op = queue[0];
        if (op.t === 'clear') {
          packet.push(op);
          queue.shift();
          continue;
        }
        if (!op.p.length) {
          queue.shift();
          continue;
        }
        const take = op.p.slice(0, budget);
        packet.push({ t: 'line', id: op.id, c: op.c, w: op.w, p: take });
        budget -= take.length;
        op.p = op.p.slice(take.length);
        if (!op.p.length && (queue.length > 1 || !current || current.id !== op.id)) queue.shift();
        else if (!op.p.length) break;
      }
      return packet;
    },
  };
};

/**
 * Joins a replayed round with the packets that arrived while the replay was in
 * flight. Relay order is store order, so the packets the replay already holds
 * are a prefix of `live` that equals a suffix of `replayed`; only the rest is
 * added. (Applying a line twice would draw a stray join; a clear twice would
 * wipe what came after it.)
 */
export const mergeReplay = (replayed: StrokeOp[], live: StrokeOp[]): StrokeOp[] => {
  const key = (op: StrokeOp) => JSON.stringify(op);
  const max = Math.min(replayed.length, live.length);
  for (let overlap = max; overlap > 0; overlap -= 1) {
    let same = true;
    for (let i = 0; i < overlap && same; i += 1) {
      same = key(replayed[replayed.length - overlap + i]) === key(live[i]);
    }
    if (same) return [...replayed, ...live.slice(overlap)];
  }
  return [...replayed, ...live];
};

/**
 * Draws ops onto a 2D context scaled from canvas units. `reset` wipes first;
 * `tails` carries the last point of each stroke between incremental calls so
 * the chunks of one stroke join up.
 */
export const renderOps = (
  ctx: CanvasRenderingContext2D,
  ops: StrokeOp[],
  {
    scale,
    reset = false,
    tails = new Map<number, StrokePoint>(),
  }: { scale: number; reset?: boolean; tails?: Map<number, StrokePoint> }
) => {
  const wipe = () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_SIZE * scale, CANVAS_SIZE * scale);
    tails.clear();
  };
  if (reset) wipe();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    if (op.t === 'clear') {
      wipe();
      continue;
    }
    if (!op.p.length) continue;
    const color = PALETTE[op.c] || PALETTE[0];
    ctx.strokeStyle = color.value;
    ctx.lineWidth = (WIDTHS[op.w] || WIDTHS[0]) * scale;
    ctx.beginPath();
    const start = tails.get(op.id) || op.p[0];
    ctx.moveTo(start[0] * scale, start[1] * scale);
    const rest = tails.has(op.id) ? op.p : op.p.slice(1);
    if (!rest.length) ctx.lineTo(start[0] * scale + 0.01, start[1] * scale);
    for (const point of rest) ctx.lineTo(point[0] * scale, point[1] * scale);
    ctx.stroke();
    tails.set(op.id, op.p[op.p.length - 1]);
  }
  return tails;
};
