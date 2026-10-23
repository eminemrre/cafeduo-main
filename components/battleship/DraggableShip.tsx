/**
 * A placed ship on the placement sea: drag it to move it, tap it to pick it
 * (a second tap turns it), or use the turn handle on the picked ship.
 * Drag uses Motion's pointer gesture; the grid math lives in battleshipPlacement.
 */
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { ShipShape, type ShipVariant } from './ShipShape';

export interface Point {
  x: number;
  y: number;
}

/** Client coordinates of a pointer, mouse or touch event. */
export const eventPoint = (event: MouseEvent | TouchEvent | PointerEvent): Point => {
  if ('changedTouches' in event && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  const pointer = event as MouseEvent;
  return { x: pointer.clientX, y: pointer.clientY };
};

interface DraggableShipProps {
  size: number;
  dir: 'h' | 'v';
  variant: ShipVariant;
  area: React.CSSProperties;
  picked: boolean;
  dragging: boolean;
  onTap: () => void;
  onRotate: () => void;
  onDragStart: (element: HTMLElement, point: Point) => void;
  onDragMove: (point: Point) => void;
  onDragEnd: (point: Point) => void;
  /** The sea the ship may be dragged within. */
  constraints: React.RefObject<HTMLElement | null>;
  testId: string;
}

export const DraggableShip: React.FC<DraggableShipProps> = ({
  size,
  dir,
  variant,
  area,
  picked,
  dragging,
  onTap,
  onRotate,
  onDragStart,
  onDragMove,
  onDragEnd,
  constraints,
  testId,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Motion can report a tap when a drag ends; a dragged ship was not tapped.
  const draggedRef = useRef(false);
  return (
    <motion.div
      ref={ref}
      className={`duo-bs-ship duo-bs-ship--over${dragging ? ' duo-bs-ship--dragging' : ''}`}
      style={area}
      drag
      dragConstraints={constraints}
      dragMomentum={false}
      dragElastic={0.12}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 700, bounceDamping: 45 }}
      whileDrag={{ scale: 1.06 }}
      initial={{ scale: 0.92, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={() => {
        draggedRef.current = false;
      }}
      onTap={() => {
        if (!draggedRef.current) onTap();
      }}
      onDragStart={(event) => {
        draggedRef.current = true;
        if (ref.current) onDragStart(ref.current, eventPoint(event));
      }}
      onDrag={(event) => onDragMove(eventPoint(event))}
      onDragEnd={(event) => onDragEnd(eventPoint(event))}
      data-testid={testId}
      aria-hidden="true"
    >
      <ShipShape
        className="duo-bs-ship-shape"
        size={size}
        dir={dir}
        variant={variant}
        tone={picked ? 'picked' : 'ink'}
      />
      {picked && !dragging && (
        <button
          type="button"
          className={`duo-bs-turn-handle duo-bs-turn-handle--${dir}`}
          aria-label="Gemiyi döndür"
          tabIndex={-1}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRotate();
          }}
          data-testid={`${testId}-turn`}
        >
          <RotateCw size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </motion.div>
  );
};
