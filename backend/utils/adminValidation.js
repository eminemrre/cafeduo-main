const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set(['user', 'admin', 'cafe_admin']);
const MAX_USERNAME_LENGTH = 80;
const MAX_DEPARTMENT_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 6;

const asTrimmed = (value) => (typeof value === 'string' ? value.trim() : '');

const asFiniteInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
};

const normalizeRole = (value) => {
  const role = asTrimmed(value);
  if (!ALLOWED_ROLES.has(role)) {
    return { ok: false, error: 'Geçersiz rol.' };
  }
  return { ok: true, value: role };
};

const normalizeCafeId = (value) => {
  const cafeId = asFiniteInteger(value);
  if (cafeId === null || cafeId <= 0) {
    return { ok: false, error: 'Kafe seçimi zorunludur.' };
  }
  return { ok: true, value: cafeId };
};

const normalizeAdminCreateUserPayload = (payload = {}) => {
  const username = asTrimmed(payload.username);
  if (!username) {
    return { ok: false, error: 'Kullanıcı adı zorunludur.' };
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return { ok: false, error: `Kullanıcı adı en fazla ${MAX_USERNAME_LENGTH} karakter olabilir.` };
  }

  const email = asTrimmed(payload.email).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Geçerli bir e-posta adresi giriniz.' };
  }

  const password = String(payload.password || '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.` };
  }

  const department = asTrimmed(payload.department);
  if (department.length > MAX_DEPARTMENT_LENGTH) {
    return { ok: false, error: `Bölüm en fazla ${MAX_DEPARTMENT_LENGTH} karakter olabilir.` };
  }

  const roleRaw = payload.role === undefined ? 'user' : payload.role;
  const roleCheck = normalizeRole(roleRaw);
  if (!roleCheck.ok) return roleCheck;

  const pointsRaw = payload.points === undefined ? 100 : payload.points;
  const points = asFiniteInteger(pointsRaw);
  if (points === null || points < 0) {
    return { ok: false, error: 'Puan 0 veya daha büyük tam sayı olmalıdır.' };
  }

  let cafeId = null;
  if (roleCheck.value === 'cafe_admin') {
    const cafeCheck = normalizeCafeId(payload.cafe_id);
    if (!cafeCheck.ok) {
      return { ok: false, error: 'Kafe yöneticisi için kafe seçimi zorunludur.' };
    }
    cafeId = cafeCheck.value;
  }

  return {
    ok: true,
    value: {
      username,
      email,
      password,
      department,
      role: roleCheck.value,
      points,
      cafeId,
    },
  };
};

const normalizeRoleUpdatePayload = (payload = {}) => {
  const roleCheck = normalizeRole(payload.role);
  if (!roleCheck.ok) return roleCheck;

  let cafeId = null;
  if (roleCheck.value === 'cafe_admin') {
    const cafeCheck = normalizeCafeId(payload.cafe_id);
    if (!cafeCheck.ok) {
      return { ok: false, error: 'Kafe yöneticisi için kafe seçimi zorunludur.' };
    }
    cafeId = cafeCheck.value;
  }

  return {
    ok: true,
    value: {
      role: roleCheck.value,
      cafeId,
    },
  };
};

const normalizePointsUpdatePayload = (payload = {}) => {
  const points = asFiniteInteger(payload.points);
  if (points === null || points < 0) {
    return { ok: false, error: 'Puan 0 veya daha büyük bir sayı olmalıdır.' };
  }
  return { ok: true, value: points };
};

module.exports = {
  normalizeAdminCreateUserPayload,
  normalizeRoleUpdatePayload,
  normalizePointsUpdatePayload,
};

