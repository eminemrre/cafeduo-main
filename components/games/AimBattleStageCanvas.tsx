/**
 * AimBattleStageCanvas
 *
 * React wrapper around the PixiJS aim battle stage. Mounts a canvas, owns
 * the async stage lifecycle, and forwards an imperative ref so the parent
 * (ArenaBattle.tsx) can drive reticle position + hit/miss feedback without
 * triggering React re-renders per frame.
 *
 * Stage failures are non-fatal: if WebGL is unavailable (test env, a phone
 * that refuses a context, a stale cached app that cannot load the pixi chunk)
 * the canvas stays blank. `onReadyChange` tells the parent whether the stage
 * is really drawing, so ArenaBattle can show its CSS reticle until it is.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { AimBattleStage, HitTier } from '../../lib/pixi/aimBattleStage';

export interface AimBattleStageHandle {
  setReticleX: (percent: number) => void;
  flash: (tier: HitTier) => void;
  showScorePopup: (label: string, tier: HitTier) => void;
  setActive: (active: boolean) => void;
}

interface AimBattleStageCanvasProps {
  className?: string;
  /** True once the stage draws the reticle; false again when it goes away. */
  onReadyChange?: (ready: boolean) => void;
}

export const AimBattleStageCanvas = forwardRef<AimBattleStageHandle, AimBattleStageCanvasProps>(
  function AimBattleStageCanvas({ className, onReadyChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const onReadyChangeRef = useRef(onReadyChange);
    onReadyChangeRef.current = onReadyChange;
    const stageRef = useRef<AimBattleStage | null>(null);
    const queuedRef = useRef<{ x?: number; flash?: HitTier; popup?: [string, HitTier] }>({});

    useImperativeHandle(
      ref,
      () => ({
        setReticleX: (percent: number) => {
          if (stageRef.current) stageRef.current.setReticleX(percent);
          else queuedRef.current.x = percent;
        },
        flash: (tier: HitTier) => {
          if (stageRef.current) stageRef.current.flash(tier);
          else queuedRef.current.flash = tier;
        },
        showScorePopup: (label: string, tier: HitTier) => {
          if (stageRef.current) stageRef.current.showScorePopup(label, tier);
          else queuedRef.current.popup = [label, tier];
        },
        setActive: (active: boolean) => {
          if (stageRef.current) stageRef.current.setActive(active);
        },
      }),
      []
    );

    useEffect(() => {
      let cancelled = false;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Dynamic import so the heavy pixi.js bundle only loads when the
      // game actually mounts, and so tests can swap the module via jest.mock.
      void import('../../lib/pixi/aimBattleStage')
        .then(({ createAimBattleStage }) => {
          if (cancelled) return undefined;
          return createAimBattleStage(canvas);
        })
        .then((stage) => {
          if (!stage) return;
          if (cancelled) {
            stage.destroy();
            return;
          }
          stageRef.current = stage;
          // Flush anything queued before stage came online
          const q = queuedRef.current;
          if (q.x !== undefined) stage.setReticleX(q.x);
          if (q.flash) stage.flash(q.flash);
          if (q.popup) stage.showScorePopup(q.popup[0], q.popup[1]);
          queuedRef.current = {};
          onReadyChangeRef.current?.(true);
        })
        .catch((err) => {
          // Non-fatal — game logic still works without the overlay

          console.warn('AimBattleStage init failed; game continues without overlay.', err);
        });

      return () => {
        cancelled = true;
        if (stageRef.current) {
          stageRef.current.destroy();
          stageRef.current = null;
          onReadyChangeRef.current?.(false);
        }
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        data-testid="aim-battle-pixi-canvas"
        aria-hidden="true"
      />
    );
  }
);
