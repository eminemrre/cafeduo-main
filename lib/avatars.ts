/**
 * Avatar catalog for CafeDuo profiles.
 *
 * The curated DiceBear images are served locally: soft toy robots in the
 * candy palette, the same register as the 3D toys on the landing (DESIGN.md).
 * Stored profile URLs keep the existing HTTP API format for compatibility
 * with the backend.
 *
 * The picker exposes a curated set of seeds (`AVATAR_SEEDS`) so users can't
 * mint arbitrary URLs. The backend (`profileHandlers.updateUserStats`) also
 * regex-validates the stored URL, locking us to the DiceBear v9 styles we
 * serve; legacy `pixel-art` URLs stay valid so old accounts keep working.
 */
export const AVATAR_STYLE = 'bottts' as const;

/** The legacy style some accounts still carry; still accepted, still rendered. */
const LEGACY_AVATAR_STYLE = 'pixel-art' as const;

/**
 * 16 curated seeds, named after the café's own things so the picker reads as
 * the product's world. Order matters — the first four are the "safe default"
 * set rendered before the user has picked anything.
 */
export const AVATAR_SEEDS = [
  'kahve',
  'masa',
  'fincan',
  'tabak',
  'kruvasik',
  'tepsi',
  'bardak',
  'kahveci',
  'kantin',
  'plaza',
  'demleme',
  'espresso',
  'latte',
  'cay',
  'tarife',
  'sampanya',
] as const;

export type AvatarSeed = (typeof AVATAR_SEEDS)[number];

/**
 * Build a DiceBear avatar URL. We always pass the curated style and only the
 * seed is user-controllable — keeps the backend regex
 * (`^https://api\.dicebear\.com/9\.x/(bottts|pixel-art)/svg\?seed=…$`) happy.
 */
export const getAvatarUrl = (seed: string | null | undefined): string => {
  const safe =
    String(seed ?? 'kahve')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 32) || 'kahve';
  return `https://api.dicebear.com/9.x/${AVATAR_STYLE}/svg?seed=${safe}`;
};

/** Both the curated style and the legacy one the backend still accepts. */
const AVATAR_URL_PATTERN = new RegExp(
  `^https://api\\.dicebear\\.com/9\\.x/(?:${AVATAR_STYLE}|${LEGACY_AVATAR_STYLE})/svg\\?seed=([A-Za-z0-9_-]{1,32})$`
);

/**
 * Extract the seed from a stored avatar_url. Returns `null` when the URL is
 * empty / unrecognised — callers fall back to initials or username.
 */
export const seedFromAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const match = AVATAR_URL_PATTERN.exec(url);
  return match ? match[1] : null;
};

/** Curated images work without contacting DiceBear; legacy seeds keep their original URL. */
export const getAvatarImageSrc = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const isCuratedStyle = url.startsWith(`https://api.dicebear.com/9.x/${AVATAR_STYLE}/`);
  if (!isCuratedStyle) return url;
  const seed = seedFromAvatarUrl(url);
  return seed && AVATAR_SEEDS.some((option) => option === seed)
    ? `/avatars/bottts-v9/${seed}.svg`
    : url;
};
