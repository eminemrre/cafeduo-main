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
  user: any;
}

const normalizeBaseUrl = (rawBase: string) => rawBase.replace(/\/+$/, '');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const resolveApiBaseUrl = (appBaseURL: string): string => {
  const override = process.env.E2E_API_BASE_URL?.trim();
  if (override) {
    return normalizeBaseUrl(override);
  }

  try {
    const parsed = new URL(appBaseURL);
    if (parsed.port === '3000') {
      parsed.port = '3001';
      return normalizeBaseUrl(parsed.toString());
    }
    if (!parsed.port && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      parsed.port = '3001';
      return normalizeBaseUrl(parsed.toString());
    }
    return normalizeBaseUrl(parsed.toString());
  } catch {
    return 'http://localhost:3001';
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
      if (res.status() < 500) {
        return;
      }
      lastError = `status=${res.status()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }

  throw new Error(`API readiness timeout (${timeoutMs}ms): ${lastError}`);
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

    return {
      credentials,
      token: loginBody.token,
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
  options: { cafeId?: number; tableNumber?: number; latitude?: number; longitude?: number; accuracy?: number } = {}
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

  const checkInRes = await request.post(`${apiRoot}/api/cafes/${selectedCafe.id}/check-in`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: '',
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
  const isDashboardReady =
    (await dashboardTab.isVisible().catch(() => false)) ||
    (await gamesButton.isVisible().catch(() => false));
  if (isDashboardReady) {
    return;
  }

  const panelButton = page.getByRole('button', { name: /PANELE GEÇ/i }).first();
  const panelReady = await panelButton
    .waitFor({ state: 'visible', timeout: 7000 })
    .then(() => true)
    .catch(() => false);

  if (panelReady) {
    await panelButton.click();
  }
  // Socket/polling trafiği olduğu için networkidle burada false-negative üretebiliyor.
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);
};
