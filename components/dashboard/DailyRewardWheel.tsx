/**
 * DailyRewardWheel — per-cafe daily spin tile.
 *
 * Each cafe runs its own wheel (configured by the cafe admin in
 * AdminDashboard). The logged-in user can spin once per Turkish
 * calendar day per cafe; the backend enforces this with a unique
 * (user_id, cafe_id, DATE(spun_at TZ Europe/Istanbul)) index.
 *
 * Rendering: the wheel is drawn as a true SVG pie — each slice is a
 * `<path>` arc, so it is circular by construction (no reliance on
 * border-radius + overflow clipping, which fails on a transformed
 * spinning element and made the old conic-gradient version render
 * square). The spin lands deterministically on the slice the backend
 * actually awarded, so the wheel stops on the real prize.
 *
 * UI states:
 *   1. Loading        — fetching today's status
 *   2. Available      — large CTA "ÇEVİR" + the wheel
 *   3. Spinning       — wheel rotates ~2.6s, lands on the won slice
 *   4. Won            — "+N PUAN" / gift overlay
 *   5. Already spun   — disabled CTA + last win recap
 *   6. Cafe missing   — gracefully hide
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Gift, RotateCw } from 'lucide-react';
import { api } from '../../lib/api';

interface WheelSlice {
  points: number;
  weight: number;
  /** When set, this slice gives a coupon (e.g. "Bedava Kahve") instead of
   *  points. Backend mints a user_items row with the gift's item_title +
   *  a fresh CD-XXXX-XXXX-XXXX code. */
  gift?: { label: string } | null;
}

interface WheelStatus {
  cafeId: number;
  cafeName?: string;
  wheel: WheelSlice[];
  alreadySpunToday: boolean;
  lastSpin: { id: number; points_won: number; spun_at: string } | null;
}

interface DailyRewardWheelProps {
  /** Cafe id accepts string | number for compatibility with User.cafe_id */
  cafeId: string | number | null | undefined;
  onPointsWon?: (points: number) => void;
  /** Fires when the spin resolves to a gift coupon (e.g. Bedava Kahve).
   *  Dashboard refetches inventory so the new ticket appears immediately. */
  onGiftWon?: (gift: { label: string }) => void;
}

// ─── Geometry ────────────────────────────────────────────────────────────────
// SVG canvas is 200×200, centred at (100,100). Layered like a classic prize
// wheel: a bold ink ring (RING_INNER..RING_OUTER), a thin white gap
// (SLICE_R..RING_INNER), then the coloured slices (0..SLICE_R).
const CX = 100;
const CY = 100;
const RING_OUTER = 98;
const RING_INNER = 86;
const SLICE_R = 82;
const HUB_R = 11;
const RING_COLOR = '#17140f';
/** How long the wheel visibly spins before the prize overlay appears. */
const SPIN_MS = 2600;

/** Polar → cartesian where `deg` is measured clockwise from the top (12 o'clock).
 *  This matches how a real wheel is read and how the top pointer sits. */
function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

/** SVG path for a pie wedge spanning [startDeg, endDeg] (clockwise from top). */
function wedgePath(startDeg: number, endDeg: number, radius = SLICE_R): string {
  const s = polar(startDeg, radius);
  const e = polar(endDeg, radius);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M${CX},${CY} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${e.x.toFixed(2)},${e.y.toFixed(2)} Z`;
}

// The candy set from DESIGN.md. Labels sit on candy, so they read in ink.
const SLICE_FILL = [
  '#1fb3ff', // gok
  '#ffd23f', // limon
  '#ff5c8a', // lokum
  '#b6d31b', // fistik
  '#0e7cc0', // gok-deep
  '#e03a6b', // lokum-deep
];

export const DailyRewardWheel: React.FC<DailyRewardWheelProps> = ({
  cafeId,
  onPointsWon,
  onGiftWon,
}) => {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  /** When the spin resolves to a points slice, holds the points count
   *  for the overlay. */
  const [justWon, setJustWon] = useState<number | null>(null);
  /** When the spin resolves to a gift slice, holds the gift label so the
   *  overlay shows the gift badge instead of a points badge. */
  const [justGift, setJustGift] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Cumulative wheel rotation in degrees — only ever increases so the wheel
   *  always spins forward, then settles with the won slice under the pointer. */
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const justWonTimer = useRef<number | null>(null);
  const prefersReduced = useReducedMotion();

  // Fetch wheel status when cafe changes.
  useEffect(() => {
    if (!cafeId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await api.wheel.get(cafeId);
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Çark bilgisi alınamadı.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cafeId]);

  useEffect(
    () => () => {
      if (justWonTimer.current) window.clearTimeout(justWonTimer.current);
    },
    []
  );

  const slices = useMemo(() => status?.wheel || [], [status]);

  // Equal-sized slices (like the reference wheel) — visual balance, not the
  // odds. The real probability lives server-side; the wheel still lands on the
  // slice the backend actually awarded.
  const geometry = useMemo(() => {
    const n = slices.length;
    const sweep = n > 0 ? 360 / n : 0;
    // Shrink labels as the wheel gets busier so the number always fits.
    const fontSize = n <= 4 ? 14 : n <= 6 ? 12 : 10;
    return slices.map((slice, idx) => {
      const start = idx * sweep;
      const end = start + sweep;
      return {
        idx,
        path: wedgePath(start, end),
        mid: start + sweep / 2,
        fill: SLICE_FILL[idx % SLICE_FILL.length],
        fontSize,
        label: slice.gift ? 'Hediye' : `+${slice.points}`,
      };
    });
  }, [slices]);

  /** Final rotation so `midDeg` lands under the top pointer, after ≥4 turns. */
  const landingRotation = (midDeg: number): number => {
    const targetMod = ((-midDeg % 360) + 360) % 360;
    const base = Math.ceil((rotationRef.current + 360 * 4) / 360) * 360;
    return base + targetMod;
  };

  /** Find the slice the backend awarded, to land the wheel on it. Prefer the
   *  server-provided pickedIndex; fall back to matching points/gift. */
  const wonSliceIndex = (resp: {
    gift?: { label: string } | null;
    pointsWon: number;
    pickedIndex?: number;
  }): number => {
    if (typeof resp.pickedIndex === 'number' && resp.pickedIndex >= 0) {
      return Math.min(resp.pickedIndex, Math.max(0, slices.length - 1));
    }
    if (resp.gift) {
      const i = slices.findIndex((s) => s.gift);
      return i >= 0 ? i : 0;
    }
    const i = slices.findIndex((s) => !s.gift && Number(s.points) === Number(resp.pointsWon));
    return i >= 0 ? i : 0;
  };

  const handleSpin = async () => {
    if (!cafeId || spinning || status?.alreadySpunToday) return;
    setSpinning(true);
    setError(null);
    try {
      let resp;
      try {
        resp = await api.wheel.spin(cafeId);
      } catch (err) {
        // The readable CSRF cookie can lapse while the auth session lives on,
        // 403-ing the spin. A GET re-mints the cookie (server self-heals on
        // safe requests); retry the spin once before surfacing the error.
        if (err instanceof Error && /csrf/i.test(err.message)) {
          await api.wheel.get(cafeId).catch(() => {});
          resp = await api.wheel.spin(cafeId);
        } else {
          throw err;
        }
      }

      // Spin the wheel to the awarded slice. The animation itself is the
      // suspense, so the prize is revealed only once it visually settles.
      const idx = wonSliceIndex(resp);
      const target = landingRotation(geometry[idx]?.mid ?? 0);
      rotationRef.current = target;
      setRotation(target);

      await new Promise((resolve) => window.setTimeout(resolve, prefersReduced ? 60 : SPIN_MS));

      if (resp.gift) {
        setJustGift(resp.gift.label);
        onGiftWon?.(resp.gift);
      } else {
        setJustWon(resp.pointsWon);
        onPointsWon?.(resp.pointsWon);
      }
      setStatus((prev) => (prev ? { ...prev, alreadySpunToday: true, lastSpin: resp.spin } : prev));
      justWonTimer.current = window.setTimeout(() => {
        setJustWon(null);
        setJustGift(null);
      }, 4500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Çark çevrilemedi.';
      setError(message);
    } finally {
      setSpinning(false);
    }
  };

  if (!cafeId) return null;

  return (
    <div
      className="duo-card bg-riso-spring p-5 sm:p-6 relative overflow-hidden"
      data-testid="daily-reward-wheel"
    >
      <div className="mb-4 min-w-0">
        <h3 className="font-riso-display text-[28px] leading-none text-carbon">Günün çarkı</h3>
        <p className="mt-1.5 truncate text-sm text-carbon">
          {status?.cafeName ? status.cafeName : 'Bu kafenin çarkı'} · günde 1 kez
        </p>
      </div>

      {loading && (
        <div role="status" className="bg-paper/60 p-6 text-center text-sm text-carbon">
          Çark yükleniyor...
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="mb-3 bg-paper p-3 text-sm text-carbon font-riso-body">
          {error}
        </div>
      )}

      {!loading && status && (
        <>
          {/* Wheel — true SVG pie, circular by construction */}
          <div className="relative mx-auto mt-3 mb-6 w-48 h-48 sm:w-56 sm:h-56">
            {slices.length > 0 ? (
              <>
                {/* Static back layer: bold pink ring + white gap. */}
                <svg
                  viewBox="0 0 200 200"
                  className="absolute inset-0 h-full w-full pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx={CX} cy={CY} r={RING_OUTER} fill={RING_COLOR} />
                  <circle cx={CX} cy={CY} r={RING_INNER} fill="#17140f" />
                </svg>

                {/* Rotating wheel face — equal coloured slices + labels. */}
                <motion.div
                  className="absolute inset-0"
                  style={{ willChange: 'transform' }}
                  animate={{ rotate: rotation }}
                  transition={{
                    duration: prefersReduced ? 0 : 2.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <svg
                    viewBox="0 0 200 200"
                    className="h-full w-full"
                    role="img"
                    aria-label="Ödül çarkı"
                  >
                    {geometry.map((g) => (
                      <path
                        key={g.idx}
                        d={g.path}
                        fill={g.fill}
                        stroke="#17140f"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        data-testid={`wheel-slice-${g.idx}`}
                      />
                    ))}
                    {geometry.map((g) => (
                      <g key={`label-${g.idx}`} transform={`rotate(${g.mid} ${CX} ${CY})`}>
                        <text
                          x={CX}
                          y={CY - SLICE_R * 0.62}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="font-riso-display"
                          style={{ fontSize: `${g.fontSize}px`, fontWeight: 800 }}
                          fill="#17140f"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </motion.div>

                {/* Static top layer: white center hub + downward pointer. */}
                <svg
                  viewBox="0 0 200 200"
                  className="absolute inset-0 h-full w-full pointer-events-none z-10"
                  aria-hidden="true"
                >
                  <circle
                    cx={CX}
                    cy={CY}
                    r={HUB_R}
                    fill="#17140f"
                    stroke={RING_COLOR}
                    strokeWidth={2}
                  />
                  <path
                    d={`M88,5 L112,5 L100,32 Z`}
                    fill="#17140f"
                    stroke={RING_COLOR}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                </svg>

                <AnimatePresence>
                  {(justWon !== null || justGift !== null) && (
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                      {justGift !== null ? (
                        <div className="duo-float flex items-center gap-2 bg-paper px-4 py-2 text-center font-riso-body text-lg font-semibold text-carbon">
                          <Gift size={20} aria-hidden="true" /> {justGift}
                        </div>
                      ) : (
                        <div className="duo-float bg-paper px-4 py-2 font-riso-body text-2xl font-bold text-carbon [font-variant-numeric:tabular-nums]">
                          +{justWon} puan
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-paper/60 text-sm text-carbon">
                Henüz dilim yok
              </div>
            )}
          </div>

          {/* Gift confirmation banner — shows the inventory-redirect hint
              when the user just won a coupon, since the points balance
              didn't change. */}
          {justGift && (
            <div role="status" className="mb-3 bg-paper p-3 text-sm text-carbon font-riso-body">
              <strong>Tebrikler!</strong> {justGift} kuponun envanterine eklendi. Kasada QR kodu
              okutarak teslim alabilirsin.
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || status.alreadySpunToday || slices.length === 0}
            data-testid="wheel-spin-button"
            className="duo-button riso-focus flex min-h-12 w-full items-center justify-center gap-2 bg-carbon px-4 font-riso-body text-base font-semibold text-paper transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-carbon/45 disabled:hover:translate-y-0"
          >
            <RotateCw size={18} className={spinning ? 'animate-spin' : ''} />
            {spinning
              ? 'Çevriliyor...'
              : status.alreadySpunToday
                ? status.lastSpin && status.lastSpin.points_won > 0
                  ? `Bugün +${status.lastSpin.points_won} aldın`
                  : 'Bugün çevirdin'
                : 'Çevir'}
          </button>

          {!status.alreadySpunToday && slices.length > 0 && (
            <p className="mt-2 text-center text-[13px] text-carbon">Her kafede ayrı çevrilir.</p>
          )}
        </>
      )}
    </div>
  );
};

export default DailyRewardWheel;
