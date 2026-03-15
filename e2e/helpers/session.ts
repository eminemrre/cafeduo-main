import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface E2ECredentials {
  username: string;
  email: string;
  password: string;
}

export interface E2ESession {
  credentials: E2ECredentials;
  token: string;
  csrfToken: string;
  user: any;
}

export const DEFAULT_E2E_APP_BASE_URL = 'http://127.0.0.1:3000';
export const DEFAULT_E2E_API_BASE_URL = 'http://127.0.0.1:3001';

const normalizeBaseUrl = (rawBase: string) => rawBase.replace(/\/+$/, '');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CHECK_IN_GATE_TIMEOUT_MS = 10000;
const E2E_CAFE_VERIFICATION_CODES: Record<string, string> = {
  '1': '1234',
  '2': '5678',
};

const parseTableNumber = (value: unknown): string => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '1';
  const match = raw.match(/\d+/);
  const parsed = Number(match?.[0] || raw);
  if (Number.isInteger(parsed) && parsed > 0) {
    return String(parsed);
  }
  return '1';
};

const isVisible = async (locator: { isVisible: () => Promise<boolean> }) =>
  locator.isVisible().catch(() => false);

const buildTableVerificationCode = (cafeId: unknown, tableNumber: string) => {
  const pin = E2E_CAFE_VERIFICATION_CODES[String(cafeId || '1')] || E2E_CAFE_VERIFICATION_CODES['1'];
  const normalizedTable = `MASA${String(parseTableNumber(tableNumber)).padStart(2, '0')}`;
  return `${pin}-${normalizedTable}`;
};

export const resolveApiBaseUrl = (appBaseURL: string): string => {
  const override = process.env.E2E_API_BASE_URL?.trim();
  if (override) {
    return normalizeBaseUrl(override);
  }

  try {
    const parsed = new URL(appBaseURL);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
    }
    if (parsed.port === '3000') {
      parsed.port = '3001';
      return normalizeBaseUrl(parsed.toString());
    }
    if (!parsed.port && parsed.hostname === '127.0.0.1') {
      parsed.port = '3001';
      return normalizeBaseUrl(parsed.toString());
    }
    return normalizeBaseUrl(parsed.toString());
  } catch {
    return DEFAULT_E2E_API_BASE_URL;
  }
};

export const waitForApiReady = async (
  request: APIRequestContext,
  apiBaseURL: string,
  timeoutMs = 45000
) => {
  const root = normalizeBaseUrl(apiBaseURL);
  const deadline = Date.now() + timeoutMs;
  let lastError = 'API unavailable';

  while (Date.now() < deadline) {
    try {
      const res = await request.get(`${root}/api/health`);
      if (res.status() === 200) {
        return;
      }
      lastError = `status=${res.status()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }

  throw new Error(`API readiness timeout (${timeoutMs}ms) for ${root}/api/health: ${lastError}`);
};

export const generateCredentials = (prefix = 'e2e'): E2ECredentials => {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 7);
  const basePrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 6) || 'e2e';
  // Auth validation: 3-20 chars, only [a-zA-Z0-9_]
  const username = `${basePrefix}_${timePart}${randomPart}`.slice(0, 20);
  const email = `${username}@example.com`;
  return {
    username,
    email,
    password: `P@ssw0rd_${timePart}${randomPart}`,
  };
};

const extractCsrfTokenFromCookies = (setCookieHeader: string | string[] | undefined): string => {
  if (!setCookieHeader) {
    return 'test-csrf-token-for-e2e';
  }

  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  
  for (const cookie of cookies) {
    const match = cookie.match(/csrf_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return 'test-csrf-token-for-e2e';
};

export const provisionUser = async (
  request: APIRequestContext,
  baseURL: string,
  prefix = 'e2e'
): Promise<E2ESession> => {
  const apiRoot = resolveApiBaseUrl(baseURL);
  await waitForApiReady(request, apiRoot);
  let lastRegisterError = 'unknown';

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const credentials = generateCredentials(prefix);
    const registerRes = await request.post(`${apiRoot}/api/auth/register`, {
      data: {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
        department: 'E2E',
      },
    });

    if (!registerRes.ok()) {
      const status = registerRes.status();
      const payload = (await registerRes.text()).slice(0, 300);
      lastRegisterError = `status=${status}, body=${payload}`;

      // Rate-limit or transient backend saturation: wait and retry.
      if (status === 429 || status >= 500) {
        const retryAfter = Number(registerRes.headers()['retry-after'] || '0');
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2) * 1000);
        continue;
      }

      // Validation/conflict style errors can happen under parallel runs; retry with a fresh identity.
      if (status >= 400 && status < 500) {
        await sleep(300);
        continue;
      }
    }

    const loginRes = await request.post(`${apiRoot}/api/auth/login`, {
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    });
    if (!loginRes.ok()) {
      const status = loginRes.status();
      if (status === 429 || status >= 500) {
        await sleep(1200);
        continue;
      }
      const body = (await loginRes.text()).slice(0, 300);
      throw new Error(`Provision login failed: status=${status}, body=${body}`);
    }

    const loginBody = await loginRes.json();
    expect(loginBody?.token).toBeTruthy();
    expect(loginBody?.user?.id).toBeTruthy();

    // Extract CSRF token from response cookies
    const csrfToken = extractCsrfTokenFromCookies(loginRes.headers()['set-cookie']);

    return {
      credentials,
      token: loginBody.token,
      csrfToken,
      user: loginBody.user,
    };
  }

  throw new Error(`Provision user failed after retries: ${lastRegisterError}`);
};

export const fetchCurrentUser = async (
  request: APIRequestContext,
  baseURL: string,
  token: string
) => {
  const apiRoot = resolveApiBaseUrl(baseURL);
  await waitForApiReady(request, apiRoot);
  const meRes = await request.get(`${apiRoot}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: '',
    },
  });
  expect(meRes.ok()).toBeTruthy();
  return meRes.json();
};

export const checkInUser = async (
  request: APIRequestContext,
  baseURL: string,
  token: string,
  options: {
    cafeId?: number;
    tableNumber?: number;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    csrfToken?: string;
  } = {}
) => {
  const apiRoot = resolveApiBaseUrl(baseURL);
  await waitForApiReady(request, apiRoot);
  const cafesRes = await request.get(`${apiRoot}/api/cafes`);
  expect(cafesRes.ok()).toBeTruthy();
  const cafes = await cafesRes.json();
  expect(Array.isArray(cafes)).toBeTruthy();
  expect(cafes.length).toBeGreaterThan(0);

  const selectedCafe = cafes.find((cafe: any) => Number(cafe.id) === Number(options.cafeId)) || cafes[0];
  const fallbackCoordinates: Record<string, { latitude: number; longitude: number }> = {
    '1': { latitude: 37.741, longitude: 29.101 },
    '2': { latitude: 37.742, longitude: 29.102 },
  };
  const fallback = fallbackCoordinates[String(selectedCafe?.id)] || fallbackCoordinates['1'];
  const latitude =
    Number.isFinite(options.latitude) ? Number(options.latitude) : Number(selectedCafe?.latitude ?? fallback.latitude);
  const longitude =
    Number.isFinite(options.longitude) ? Number(options.longitude) : Number(selectedCafe?.longitude ?? fallback.longitude);
  const accuracy = Number.isFinite(options.accuracy) ? Number(options.accuracy) : 35;
  const tableNumber = options.tableNumber || 1;
  const csrfToken = options.csrfToken || 'test-csrf-token-for-e2e';

  const checkInRes = await request.post(`${apiRoot}/api/cafes/${selectedCafe.id}/check-in`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
      Cookie: `csrf_token=${csrfToken}`,
    },
    data: {
      latitude,
      longitude,
      accuracy,
      tableNumber,
    },
  });
  expect(checkInRes.ok()).toBeTruthy();
  return checkInRes.json();
};

export const bootstrapAuthenticatedPage = async (
  page: Page,
  baseURL: string,
  session: E2ESession,
  options: { checkedIn?: boolean; userOverride?: any } = {}
) => {
  const checkedIn = Boolean(options.checkedIn);
  const baseUser = options.userOverride || session.user;
  const user = checkedIn
    ? {
        ...baseUser,
        cafe_id: baseUser?.cafe_id || 1,
        table_number: baseUser?.table_number || 'MASA01',
      }
    : baseUser;
  const root = normalizeBaseUrl(baseURL);
  const rootUrl = new URL(root);
  await page.goto(root);

  await page.context().addCookies([
    {
      name: 'auth_token',
      value: session.token,
      domain: rootUrl.hostname,
      httpOnly: true,
      sameSite: 'Lax',
      secure: root.startsWith('https://'),
      path: '/',
    },
    {
      name: 'csrf_token',
      value: session.csrfToken || 'test-csrf-token-for-e2e',
      domain: rootUrl.hostname,
      httpOnly: false,
      sameSite: 'Lax',
      secure: root.startsWith('https://'),
      path: '/',
    },
  ]);

  await page.evaluate(
    ({ userData, checkedIn }) => {
      localStorage.setItem('cafe_user', JSON.stringify(userData));
      localStorage.setItem('cookie_consent', 'true');
      if (checkedIn) {
        sessionStorage.setItem('cafeduo_checked_in_user_id', String(userData.id));
      }
    },
    {
      userData: user,
      checkedIn: Boolean(options.checkedIn),
    }
  );
  // Session restore effect'i cookie + local cache ile çalıştığı için reload gerekir.
  await page.reload();
  await page.goto(`${root}/dashboard`);

  // App initially redirects to "/" while async session restore runs.
  const dashboardTab = page.locator('[data-testid="dashboard-tab-games"]').first();
  const gamesButton = page.getByRole('button', { name: /OYUNLAR/i }).first();
  const checkInSubmit = page.locator('[data-testid="checkin-submit-button"]').first();
  const panelButton = page.getByRole('button', { name: /PANELE GEÇ/i }).first();
  const performCheckInRecovery = async () => {
    const selectedCafeId = String(user?.cafe_id || '1');
    const tableNumber = parseTableNumber(user?.table_number);
    const verificationCode = buildTableVerificationCode(selectedCafeId, tableNumber);
    const cafeSelect = page.locator('[data-testid="checkin-cafe-select"]');
    const tableInput = page.locator('[data-testid="checkin-table-input"]');
    const verificationInput = page.locator('#checkin-verification-code');

    await cafeSelect.waitFor({ state: 'visible', timeout: 3000 });
    await cafeSelect.selectOption(selectedCafeId);
    await tableInput.fill(tableNumber);
    await expect(tableInput).toHaveValue(tableNumber);
    await verificationInput.fill(verificationCode);
    await expect(verificationInput).toHaveValue(verificationCode);
    await expect(checkInSubmit).toBeEnabled({ timeout: 3000 });
    await checkInSubmit.click();

    return (
      (await dashboardTab
        .waitFor({ state: 'visible', timeout: CHECK_IN_GATE_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false)) ||
      (await gamesButton
        .waitFor({ state: 'visible', timeout: CHECK_IN_GATE_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false))
    );
  };

  const waitForSurface = async (
    timeoutMs: number
  ): Promise<'dashboard' | 'checkin' | 'panel' | 'timeout'> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await isVisible(dashboardTab)) || (await isVisible(gamesButton))) {
        return 'dashboard';
      }
      if (checkedIn && (await isVisible(checkInSubmit))) {
        return 'checkin';
      }
      if (await isVisible(panelButton)) {
        return 'panel';
      }
      await page.waitForTimeout(250);
    }
    return 'timeout';
  };

  const initialSurface = await waitForSurface(7000);
  if (initialSurface === 'dashboard') {
    return;
  }

  if (checkedIn && initialSurface === 'checkin') {
    const dashboardAfterCheckIn = await performCheckInRecovery();
    if (dashboardAfterCheckIn) {
      return;
    }
  }

  if (initialSurface === 'panel') {
    await panelButton.click();
  }
  // Socket/polling trafiği olduğu için networkidle burada false-negative üretebiliyor.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  const finalSurface = await waitForSurface(CHECK_IN_GATE_TIMEOUT_MS);
  if (checkedIn && finalSurface === 'checkin') {
    await performCheckInRecovery();
  }
};
