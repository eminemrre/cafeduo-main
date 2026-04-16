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

export const playGameSfx = (key: GameSfxKey, volume = 0.35) => {
  if (!isAudioEnabledRuntime()) return;
  try {
    const source = getBaseAudio(key);
    const instance = source.cloneNode() as HTMLAudioElement;
    instance.volume = Math.min(1, Math.max(0, volume));
    void instance.play();
  } catch {
    // Audio should never block gameplay flow.
  }
};

