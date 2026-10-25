/**
 * Browser-side access to the Turkish letter helpers in
 * `shared/turkishText.js` (same global bridge as `lib/battleship.ts`).
 */
import '../shared/turkishText';

interface TurkishTextApi {
  TURKISH_ALPHABET: readonly string[];
  isTurkishLetter: (value: unknown) => boolean;
  normalizeGuess: (value: unknown) => string;
  normalizeLetter: (value: unknown) => string | null;
}

const api = (globalThis as typeof globalThis & { __CAFEDUO_TURKISH_TEXT__?: TurkishTextApi })
  .__CAFEDUO_TURKISH_TEXT__;

if (!api) {
  throw new Error('Turkish text module failed to initialize.');
}

export const TURKISH_ALPHABET = api.TURKISH_ALPHABET;
export const isTurkishLetter = api.isTurkishLetter;
export const normalizeGuess = api.normalizeGuess;
export const normalizeLetter = api.normalizeLetter;
