/**
 * Paylaşılan framer-motion variant'ları (v2).
 * Pazarlama sayfalarındaki scroll-reveal + stagger için tek kaynak.
 * Süre/eğri değerleri lib/motion.ts token'larından gelir.
 * Saf veri (test-nötr); animasyon/erişilebilirlik mantığı Reveal.tsx içinde.
 */
import type { Variants } from 'framer-motion';
import { DURATION, EASE, STAGGER } from '../../lib/motion';

/** Tekil blok girişi — the house curve. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE.brand } },
};

/** Parent: çocukları sırayla tetikler (elle delay:index*N hesabının yerini alır). */
export const staggerContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** staggerContainer altındaki çocuklar. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE.brand } },
};

/** prefers-reduced-motion: sadece kısa opacity, hareket yok. */
export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** Sonuç kartı girişi — damga vurulmuş hissi (hafif scale + yukarı kayma). */
export const popIn: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE.brand } },
};

/** Hover/tap mikro-etkileşim — a small lift. */
export const hoverShift = {
  whileHover: { y: -3, transition: { duration: DURATION.fast, ease: EASE.brand } },
  whileTap: { y: 0, scale: 0.99 },
} as const;

/**
 * Mobil menü paneli: satırlar açılışta yukarıdan aşağıya 20 ms arayla
 * belirir, kapanışta ters sırayla kaybolur (staggerDirection: -1).
 */
export const menuPanel: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.base,
      ease: EASE.brand,
      delayChildren: STAGGER,
      staggerChildren: STAGGER,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: DURATION.fast,
      ease: EASE.brand,
      staggerChildren: STAGGER,
      staggerDirection: -1,
    },
  },
};

/** menuPanel içindeki tek satır. */
export const menuItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.brand } },
  exit: { opacity: 0, y: 6, transition: { duration: DURATION.fast, ease: EASE.brand } },
};

/** Menü arkası perdesi — yalnızca solma. */
export const menuBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.fast, ease: EASE.brand } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE.brand } },
};
