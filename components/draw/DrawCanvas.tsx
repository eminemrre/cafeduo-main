/**
 * The Çiz Bil board: a square white canvas in shared 1000 × 1000 units.
 *
 * It keeps its own log of ops so it can redraw on resize, and draws pointer
 * input straight onto the canvas (no React state per point). The parent feeds
 * remote packets through the imperative handle and receives the drawer's
 * points through `onBegin` / `onPoint` / `onEnd`.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { CANVAS_SIZE, renderOps, toCanvasPoint, type StrokeOp, type StrokePoint } from '../../lib/drawCanvas';

export interface DrawCanvasHandle {
  /** Draws more ops on top of what is there. */
  append: (ops: StrokeOp[]) => void;
  /** Replaces everything (new round, replay after a reload). */
  replace: (ops: StrokeOp[]) => void;
}

interface DrawCanvasProps {
  editable: boolean;
  /** Starts a stroke; returns its wire id, colour and width indexes. */
  onBegin?: () => { id: number; c: number; w: number } | null;
  /** Offers a point of the current stroke; returns it if it was kept. */
  onPoint?: (point: StrokePoint) => StrokePoint | null;
  onEnd?: () => void;
  label: string;
}

export const DrawCanvas = forwardRef<DrawCanvasHandle, DrawCanvasProps>(
  ({ editable, onBegin, onPoint, onEnd, label }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const logRef = useRef<StrokeOp[]>([]);
    const tailsRef = useRef(new Map<number, StrokePoint>());
    /** The stroke being drawn and the one pointer drawing it (a second finger is ignored). */
    const strokeRef = useRef<{ id: number; c: number; w: number; pointerId: number } | null>(null);

    const context = () => canvasRef.current?.getContext('2d') || null;
    const scale = () => (canvasRef.current ? canvasRef.current.width / CANVAS_SIZE : 1);

    const redraw = useCallback(() => {
      const ctx = context();
      if (!ctx) return;
      tailsRef.current = renderOps(ctx, logRef.current, { scale: scale(), reset: true });
    }, []);

    const drawMore = (ops: StrokeOp[]) => {
      logRef.current.push(...ops);
      const ctx = context();
      if (ctx) renderOps(ctx, ops, { scale: scale(), tails: tailsRef.current });
    };

    useImperativeHandle(ref, () => ({
      append: drawMore,
      replace: (ops) => {
        logRef.current = [...ops];
        redraw();
      },
    }));

    // Keep the backing store at device resolution; redraw on every resize.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const fit = () => {
        const width = canvas.clientWidth || CANVAS_SIZE / 2;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const size = Math.round(width * ratio);
        if (canvas.width !== size) {
          canvas.width = size;
          canvas.height = size;
        }
        redraw();
      };
      fit();
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
      observer?.observe(canvas);
      // A zoom or a move to another screen changes the pixel ratio, not the size.
      let media: MediaQueryList | null = null;
      const watchRatio = () => {
        media?.removeEventListener?.('change', onRatio);
        media = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) || null;
        media?.addEventListener?.('change', onRatio);
      };
      const onRatio = () => {
        fit();
        watchRatio();
      };
      watchRatio();
      return () => {
        observer?.disconnect();
        media?.removeEventListener?.('change', onRatio);
      };
    }, [redraw]);

    // The drawing closed under a held finger: end that stroke here.
    useEffect(() => {
      if (editable || !strokeRef.current) return;
      strokeRef.current = null;
      onEnd?.();
    }, [editable, onEnd]);

    const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) =>
      toCanvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

    const offer = (point: StrokePoint) => {
      const stroke = strokeRef.current;
      if (!stroke || !onPoint) return;
      const kept = onPoint(point);
      if (kept) drawMore([{ t: 'line', id: stroke.id, c: stroke.c, w: stroke.w, p: [kept] }]);
    };

    const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!editable || !onBegin || strokeRef.current) return;
      const stroke = onBegin();
      if (!stroke) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      strokeRef.current = { ...stroke, pointerId: event.pointerId };
      offer(pointAt(event));
    };
    const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!editable || !strokeRef.current || event.pointerId !== strokeRef.current.pointerId) return;
      const events = event.nativeEvent.getCoalescedEvents?.() || [event.nativeEvent];
      const rect = event.currentTarget.getBoundingClientRect();
      for (const sample of events) offer(toCanvasPoint(sample.clientX, sample.clientY, rect));
    };
    const handleUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!strokeRef.current || event.pointerId !== strokeRef.current.pointerId) return;
      strokeRef.current = null;
      onEnd?.();
    };

    return (
      <canvas
        ref={canvasRef}
        className={`duo-draw-canvas${editable ? ' duo-draw-canvas--editable' : ''}`}
        role="img"
        aria-label={label}
        data-testid="draw-canvas"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
      />
    );
  }
);

DrawCanvas.displayName = 'DrawCanvas';
