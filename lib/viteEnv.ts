/** Public Vite variables injected at build time; safe under CSP and in Jest. */
type ViteEnv = Readonly<Record<string, string | undefined>>;
declare const __CAFE_VITE_ENV__: ViteEnv;

let cached: ViteEnv | null = null;

export const getViteEnv = (): ViteEnv => {
  if (cached === null) {
    cached = typeof __CAFE_VITE_ENV__ === 'undefined' ? {} : __CAFE_VITE_ENV__;
  }
  return cached;
};

export const getViteEnvVar = (name: string): string => {
  const value = getViteEnv()[name];
  return typeof value === 'string' ? value : '';
};

/** For tests only — resets the cache so a remock can take effect. */
export const __resetViteEnvCache = () => {
  cached = null;
};
