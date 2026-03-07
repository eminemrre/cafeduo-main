const DEFAULT_ALLOWED_ORIGINS = [
  'https://cafeduotr.com',
  'https://www.cafeduotr.com',
];

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const SUPPORTED_GAME_TYPES = new Set([
  'Refleks Avı',
  'Tank Düellosu',
  'Retro Satranç',
  'Bilgi Yarışı',
  'UNO Sosyal',
  '101 Okey Sosyal',
  'Monopoly Sosyal',
]);

const normalizeGameType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (SUPPORTED_GAME_TYPES.has(raw)) return raw;

  const aliasMap = {
    refleks: 'Refleks Avı',
    reflex: 'Refleks Avı',
    rps: 'Refleks Avı',
    arena: 'Tank Düellosu',
    rhythm: 'Tank Düellosu',
    ritim_kopyala: 'Tank Düellosu',
    tank: 'Tank Düellosu',
    tank_duellosu: 'Tank Düellosu',
    chess: 'Retro Satranç',
    satranc: 'Retro Satranç',
    retro_satranc: 'Retro Satranç',
    strategy: 'Retro Satranç',
    dungeon: 'Retro Satranç',
    odd_even: 'Retro Satranç',
    odd_even_sprint: 'Retro Satranç',
    sprint: 'Retro Satranç',
    cift_tek_sprint: 'Retro Satranç',
    knowledge: 'Bilgi Yarışı',
    quiz: 'Bilgi Yarışı',
    trivia: 'Bilgi Yarışı',
    bilgi: 'Bilgi Yarışı',
    bilgi_yarisi: 'Bilgi Yarışı',
    uno: 'UNO Sosyal',
    uno_sosyal: 'UNO Sosyal',
    okey: '101 Okey Sosyal',
    okey_101: '101 Okey Sosyal',
    okey101: '101 Okey Sosyal',
    one_zero_one_okey: '101 Okey Sosyal',
    monopoly: 'Monopoly Sosyal',
    monopoly_sosyal: 'Monopoly Sosyal',
  };

  const normalizedKey = raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return aliasMap[normalizedKey] || null;
};

const normalizeTableCode = (rawValue) => {
  const raw = String(rawValue || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('MASA')) return raw;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `MASA${String(numeric).padStart(2, '0')}`;
  }
  return null;
};

const parseAllowedOrigins = (originsValue, nodeEnv = process.env.NODE_ENV) => {
  const parsed = (originsValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const baseOrigins = parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
  if (nodeEnv === 'production') {
    return baseOrigins;
  }

  return Array.from(new Set([...baseOrigins, ...LOCAL_ALLOWED_ORIGINS]));
};

const parseAdminEmails = (emailsValue, fallback = []) => {
  const source = emailsValue || fallback.join(',');
  return source
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  LOCAL_ALLOWED_ORIGINS,
  SUPPORTED_GAME_TYPES,
  normalizeGameType,
  normalizeTableCode,
  parseAllowedOrigins,
  parseAdminEmails,
};
