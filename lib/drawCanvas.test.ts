import {
  CANVAS_SIZE,
  MAX_OPS_PER_PACKET,
  MAX_POINTS_PER_PACKET,
  PALETTE,
  WIDTHS,
  createStrokeBatcher,
  mergeReplay,
  renderOps,
  toCanvasPoint,
  type StrokeOp,
} from './drawCanvas';

const rect = { left: 10, top: 20, width: 200, height: 200 } as DOMRect;

describe('drawCanvas', () => {
  it('maps a pointer to integer canvas units and clamps it to the board', () => {
    expect(toCanvasPoint(10, 20, rect)).toEqual([0, 0]);
    expect(toCanvasPoint(110, 120, rect)).toEqual([500, 500]);
    expect(toCanvasPoint(500, -5, rect)).toEqual([CANVAS_SIZE, 0]);
    expect(toCanvasPoint(10.3, 20.3, rect)).toEqual([2, 2]);
  });

  it('matches the server palette and widths', () => {
    // backend/gameEngine/drawStrokes.js: COLOR_COUNT 8, WIDTH_COUNT 3.
    expect(PALETTE).toHaveLength(8);
    expect(WIDTHS).toHaveLength(3);
    expect(PALETTE[PALETTE.length - 1].eraser).toBe(true);
  });

  it('batches a stroke into packets within the server limits and keeps every point', () => {
    const batcher = createStrokeBatcher();
    batcher.begin(1, 0, 1);
    // 10 units apart, so none is dropped as too close.
    for (let i = 0; i < 300; i += 1) batcher.add([(i % 100) * 10, Math.floor(i / 100) * 10]);
    const packets: StrokeOp[][] = [];
    for (let packet = batcher.flush(); packet.length; packet = batcher.flush()) packets.push(packet);
    for (const packet of packets) {
      expect(packet.length).toBeLessThanOrEqual(MAX_OPS_PER_PACKET);
      const points = packet.reduce((sum, op) => sum + (op.t === 'line' ? op.p.length : 0), 0);
      expect(points).toBeLessThanOrEqual(MAX_POINTS_PER_PACKET);
    }
    const all = packets.flat().flatMap((op) => (op.t === 'line' ? op.p : []));
    expect(all).toHaveLength(300);
    expect(all[299]).toEqual([990, 20]);
    expect(packets.flat().every((op) => op.t === 'line' && op.id === 1 && op.c === 0 && op.w === 1)).toBe(true);
  });

  it('drops points too close to the previous one and queues a clear in order', () => {
    const batcher = createStrokeBatcher();
    batcher.begin(2, 3, 0);
    batcher.add([100, 100]);
    batcher.add([101, 101]);
    batcher.add([110, 100]);
    batcher.clear();
    expect(batcher.flush()).toEqual([{ t: 'line', id: 2, c: 3, w: 0, p: [[100, 100], [110, 100]] }, { t: 'clear' }]);
    expect(batcher.flush()).toEqual([]);
  });

  it('merges a replay with the packets that arrived while it was in flight, without doubles', () => {
    const a: StrokeOp = { t: 'line', id: 1, c: 0, w: 0, p: [[0, 0], [10, 0]] };
    const b: StrokeOp = { t: 'line', id: 1, c: 0, w: 0, p: [[20, 0]] };
    const c: StrokeOp = { t: 'line', id: 1, c: 0, w: 0, p: [[30, 0]] };
    // b reached the store before the read and also arrived live: applied once.
    expect(mergeReplay([a, b], [b, c])).toEqual([a, b, c]);
    expect(mergeReplay([a], [b, c])).toEqual([a, b, c]);
    expect(mergeReplay([a, b, c], [b, c])).toEqual([a, b, c]);
    expect(mergeReplay([], [a])).toEqual([a]);
    expect(mergeReplay([a], [])).toEqual([a]);
    // A clear that is already in the replay is not applied again over later lines.
    const clear: StrokeOp = { t: 'clear' };
    expect(mergeReplay([a, clear, b], [clear, b, c])).toEqual([a, clear, b, c]);
  });

  it('replays lines, joins the chunks of one stroke and wipes on clear', () => {
    const calls: string[] = [];
    const ctx = {
      set fillStyle(value: string) {
        calls.push(`fill ${value}`);
      },
      set strokeStyle(value: string) {
        calls.push(`stroke ${value}`);
      },
      set lineWidth(value: number) {
        calls.push(`width ${value}`);
      },
      lineCap: '',
      lineJoin: '',
      fillRect: () => calls.push('wipe'),
      beginPath: () => calls.push('begin'),
      moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
      stroke: () => calls.push('draw'),
    } as unknown as CanvasRenderingContext2D;
    renderOps(
      ctx,
      [
        { t: 'line', id: 1, c: 0, w: 0, p: [[0, 0], [100, 0]] },
        { t: 'line', id: 1, c: 0, w: 0, p: [[100, 100]] },
        { t: 'clear' },
        { t: 'line', id: 2, c: 1, w: 2, p: [[500, 500]] },
      ],
      { scale: 0.5, reset: true }
    );
    expect(calls.filter((call) => call === 'wipe')).toHaveLength(2);
    // The second chunk of stroke 1 starts where the first ended.
    expect(calls).toContain('move 50,0');
    expect(calls).toContain('line 50,50');
    // A single point is drawn as a dot.
    expect(calls.slice(-3)).toEqual(['move 250,250', 'line 250.01,250', 'draw']);
  });
});
