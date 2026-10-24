import { GAME_ASSETS, GameSfxKey } from './gameAssets';

const baseCache = new Map<GameSfxKey, HTMLAudioElement>();

const isAudioEnabledRuntime = (): boolean => {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(String(navigator.userAgent || ''))) {
    return false;
  }
  return true;
};

const getBaseAudio = (key: GameSfxKey): HTMLAudioElement => {
  const cached = baseCache.get(key);
  if (cached) return cached;
  const audio = new Audio(GAME_ASSETS.sfx[key]);
  audio.preload = 'auto';
  baseCache.set(key, audio);
  return audio;
};

/**
 * Browsers (iOS in particular) refuse playback until the page has had a user
 * gesture. Where the User Activation API exists, skip sounds before that; where
 * it does not, the refused play() promise is still handled below.
 */
const hasUserActivation = (): boolean => {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return activation ? activation.hasBeenActive : true;
};

export const playGameSfx = (key: GameSfxKey, volume = 0.35) => {
  if (!isAudioEnabledRuntime() || !hasUserActivation()) return;
  try {
    const source = getBaseAudio(key);
    const instance = source.cloneNode() as HTMLAudioElement;
    instance.volume = Math.min(1, Math.max(0, volume));
    // play() reports a refusal (NotAllowedError) by rejecting, not by throwing;
    // an unhandled rejection reached Sentry as JAVASCRIPT-REACT-8/9/A.
    const playback = instance.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => undefined);
    }
  } catch {
    // Audio should never block gameplay flow.
  }
};

