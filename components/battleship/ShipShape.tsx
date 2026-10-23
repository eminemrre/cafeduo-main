/**
 * Top-down ship silhouettes for Amiral Battı, drawn like the Masa toys: a flat
 * ink hull with a pointed bow and white deck works. One cell is 100 units; the
 * shape is drawn lying horizontally (bow to the right) and turned for `v`.
 */
import React from 'react';

export type ShipVariant = 'battleship' | 'destroyer' | 'submarine' | 'patrol';
export type ShipTone = 'ink' | 'picked' | 'ghost' | 'blocked';

/** The fleet in order 4, 3, 3, 2: a battleship, a destroyer, a submarine, a patrol boat. */
export const variantFor = (size: number, fleetIndex?: number): ShipVariant => {
  if (size >= 4) return 'battleship';
  if (size === 2) return 'patrol';
  return fleetIndex === 2 ? 'submarine' : 'destroyer';
};

export const VARIANT_NAME: Record<ShipVariant, string> = {
  battleship: 'Zırhlı',
  destroyer: 'Muhrip',
  submarine: 'Denizaltı',
  patrol: 'Hücumbot',
};

const TONES: Record<ShipTone, { hull: string; deck: string; detail: string; opacity: number }> = {
  ink: { hull: '#17140F', deck: '#FFFFFF', detail: '#17140F', opacity: 1 },
  picked: { hull: '#2EC4B6', deck: '#FFFFFF', detail: '#17140F', opacity: 1 },
  ghost: { hull: '#2EC4B6', deck: '#FFFFFF', detail: '#17140F', opacity: 0.55 },
  blocked: { hull: '#D62F2F', deck: '#FFFFFF', detail: '#17140F', opacity: 0.55 },
};

/** Pointed bow on the right, squared stern with rounded corners on the left. */
const hullPath = (length: number) =>
  `M18 16 L${length - 80} 16 C${length - 36} 16 ${length - 10} 34 ${length - 4} 50 ` +
  `C${length - 10} 66 ${length - 36} 84 ${length - 80} 84 L18 84 Q6 84 6 72 L6 28 Q6 16 18 16 Z`;

/** A cigar hull, rounded at both ends. */
const submarinePath = (length: number) =>
  `M44 30 L${length - 44} 30 Q${length - 4} 30 ${length - 4} 50 Q${length - 4} 70 ${length - 44} 70 ` +
  'L44 70 Q4 70 4 50 Q4 30 44 30 Z';

const Turret: React.FC<{ cx: number; aft?: boolean; tone: (typeof TONES)[ShipTone] }> = ({
  cx,
  aft = false,
  tone,
}) => (
  <g>
    <rect x={aft ? cx - 34 : cx} y={46} width={34} height={8} rx={3} fill={tone.deck} />
    <circle cx={cx} cy={50} r={14} fill={tone.deck} />
    <circle cx={cx} cy={50} r={5} fill={tone.detail} />
  </g>
);

const Bridge: React.FC<{ x: number; width: number; tone: (typeof TONES)[ShipTone] }> = ({
  x,
  width,
  tone,
}) => (
  <g>
    <rect x={x} y={31} width={width} height={38} rx={9} fill={tone.deck} />
    <rect x={x + width - 16} y={39} width={7} height={22} rx={3} fill={tone.detail} />
  </g>
);

const Funnel: React.FC<{ cx: number; tone: (typeof TONES)[ShipTone] }> = ({ cx, tone }) => (
  <g>
    <circle cx={cx} cy={50} r={12} fill={tone.deck} />
    <circle cx={cx} cy={50} r={6} fill={tone.detail} />
  </g>
);

const Works: React.FC<{ variant: ShipVariant; length: number; tone: (typeof TONES)[ShipTone] }> = ({
  variant,
  length,
  tone,
}) => {
  if (variant === 'submarine') {
    return (
      <g>
        <rect x={length / 2 - 34} y={38} width={68} height={24} rx={12} fill={tone.deck} />
        <circle cx={length / 2 + 14} cy={50} r={5} fill={tone.detail} />
      </g>
    );
  }
  if (variant === 'patrol') {
    return (
      <g>
        <Bridge x={36} width={70} tone={tone} />
        <Turret cx={146} tone={tone} />
      </g>
    );
  }
  if (variant === 'destroyer') {
    return (
      <g>
        <Funnel cx={64} tone={tone} />
        <Bridge x={98} width={78} tone={tone} />
        <Turret cx={222} tone={tone} />
      </g>
    );
  }
  return (
    <g>
      <Turret cx={58} aft tone={tone} />
      <Funnel cx={122} tone={tone} />
      <Bridge x={154} width={86} tone={tone} />
      <Turret cx={276} tone={tone} />
      <Turret cx={338} tone={tone} />
    </g>
  );
};

interface ShipShapeProps {
  size: number;
  dir: 'h' | 'v';
  variant: ShipVariant;
  tone?: ShipTone;
  className?: string;
}

export const ShipShape: React.FC<ShipShapeProps> = ({
  size,
  dir,
  variant,
  tone = 'ink',
  className,
}) => {
  const length = size * 100;
  const colors = TONES[tone];
  const vertical = dir === 'v';
  return (
    <svg
      className={className}
      viewBox={vertical ? `0 0 100 ${length}` : `0 0 ${length} 100`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={vertical ? 'translate(100 0) rotate(90)' : undefined} opacity={colors.opacity}>
        <path
          d={variant === 'submarine' ? submarinePath(length) : hullPath(length)}
          fill={colors.hull}
        />
        <Works variant={variant} length={length} tone={colors} />
      </g>
    </svg>
  );
};
