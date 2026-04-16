import type { BuildMeta } from '../types';

const resolveEnvValue = (expression: string): string => {
  try {
    const value = new Function(`return ${expression}`)();
    return String(value || '').trim();
  } catch {
    return '';
  }
};

const normalizeVersion = (rawVersion: string): string => {
  const cleaned = String(rawVersion || '').trim();
  if (!cleaned) return 'local';
  return cleaned.replace(/[^\w.-]/g, '').slice(0, 40) || 'local';
};

const toShortVersion = (version: string): string => {
  const base = normalizeVersion(version);
  if (/^[a-f0-9]{8,}$/i.test(base)) {
    return base.slice(0, 7);
  }
  return base.slice(0, 12);
};

const resolveBuildMeta = (): BuildMeta => {
  const version = normalizeVersion(resolveEnvValue('import.meta.env?.VITE_APP_VERSION || ""'));
  const buildTime = resolveEnvValue('import.meta.env?.VITE_BUILD_TIME || ""');

  return {
    version,
    shortVersion: toShortVersion(version),
    buildTime: buildTime || 'unknown',
  };
};

export const BUILD_META = resolveBuildMeta();

