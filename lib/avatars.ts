/**
 * Avatar catalog for CafeDuo profiles.
 *
 * The curated DiceBear v9 images are served locally. Stored profile URLs keep
 * the existing HTTP API format for compatibility with the backend.
 *
 * The picker exposes a curated set of seeds (`AVATAR_SEEDS`) so users can't
 * mint arbitrary URLs. The backend (`profileHandlers.updateUserStats`) also
 * regex-validates the stored URL, locking us to the `pixel-art` style — that
 * matches the riso/print aesthetic of the rest of the app.
 */
export const AVATAR_STYLE = 'pixel-art' as const;

/**
 * 16 curated seeds. Names are intentionally a mix of CafeDuo vocabulary
 * (cafe, masa, neon…) and short fantasy syllables so the picker has visual
 * variety without revealing user identity. Order matters — first 4 are
 * the "safe default" set we render before the user has picked anything.
 */
export const AVATAR_SEEDS = [
  'kahve',
  'masa',
  'neon',
  'duo',
  'riso',
  'pixel',
  'turbo',
  'plaza',
  'orbit',
  'cyber',
  'glitch',
  'echo',
  'mango',
  'kantin',
  'jeton',
  'kupon',
] as const;

export type AvatarSeed = (typeof AVATAR_SEEDS)[number];

/**
 * Build a DiceBear avatar URL. We always pass `pixel-art` and only the seed
 * is user-controllable — keeps the backend regex (`^https://api\.dicebear\.com/9\.x/pixel-art/svg\?seed=...$`)
 * happy.
 *
 * Allowed seed characters: letters, digits, dash, underscore. Anything outside
 * that range gets sanitised so we never produce a URL the backend would
 * reject (e.g. if we ever fall back to `currentUser.username` which can hold
 * a wider charset).
 */
export const getAvatarUrl = (seed: string | null | undefined): string => {
  const safe =
    String(seed ?? 'duo')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 32) || 'duo';
  return `https://api.dicebear.com/9.x/${AVATAR_STYLE}/svg?seed=${safe}`;
};

/**
 * Extract the seed from a stored avatar_url. Returns `null` if the URL is
 * empty / unrecognised — callers fall back to initials or username.
 */
export const seedFromAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const match =
    /^https:\/\/api\.dicebear\.com\/9\.x\/pixel-art\/svg\?seed=([A-Za-z0-9_-]{1,32})$/.exec(url);
  return match ? match[1] : null;
};

/** Curated images work without contacting DiceBear; existing custom seeds stay compatible. */
export const getAvatarImageSrc = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const seed = seedFromAvatarUrl(url);
  return seed && AVATAR_SEEDS.some((option) => option === seed)
    ? `/avatars/pixel-art-v9/${seed}.svg`
    : url;
};
