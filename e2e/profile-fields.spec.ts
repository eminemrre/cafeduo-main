import { test, expect } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser, bootstrapAuthenticatedPage, resolveApiBaseUrl, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

for (const field of ['department', 'avatar_url'] as const) {
  test(`@smoke ${field} edits preserve statistics updated while the profile request is pending`, async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    const session = await provisionUser(request, root, 'fields');
    await checkInUser(request, root, session.token, { tableNumber: 7, csrfToken: session.csrfToken });
    const user = await fetchCurrentUser(request, root, session.token);
    await bootstrapAuthenticatedPage(page, root, session, { checkedIn: true, userOverride: user, skipCheckInRecovery: true });
    let release!: () => void;
    const held = new Promise<void>(done => { release = done; });
    const payloads: unknown[] = [];
    await page.route('**/api/users/*/profile', async route => {
      payloads.push(route.request().postDataJSON());
      expect(route.request().method()).toBe('PATCH');
      await held;
      await route.continue();
    });
    await page.getByRole('button', { name: 'Profilini aç' }).click();
    const profile = page.getByRole('dialog', { name: /profili$/ });
    if (field === 'department') {
      await profile.getByRole('button', { name: 'Bölümü düzenle' }).click();
      await profile.getByRole('combobox', { name: 'Bölüm' }).selectOption('İşletme');
      await profile.getByRole('button', { name: 'Bölümü kaydet' }).click();
    } else {
      await profile.getByRole('button', { name: 'Avatar seç' }).click();
      await page.getByTestId('avatar-option-duo').click();
    }
    await expect.poll(() => payloads.length).toBe(1);
    const expectedPatch = field === 'department' ? { department: 'İşletme' } : { avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=duo' };
    expect(payloads[0]).toEqual(expectedPatch);
    const stats = { points: 1700, wins: 9, gamesPlayed: 15 };
    // Change only this disposable local test user's statistics after the form snapshot.
    const updated = await request.put(`${apiRoot}/api/users/${user.id}`, {
      headers: { Authorization: `Bearer ${session.token}`, 'X-CSRF-Token': session.csrfToken, Cookie: `csrf_token=${session.csrfToken}` },
      data: { ...stats, department: user.department || '' },
    });
    expect(updated.ok()).toBeTruthy();
    release();
    if (field === 'department') await expect(profile.getByRole('combobox')).toHaveCount(0);
    else await expect(page.getByRole('dialog', { name: 'Avatar seçimi' })).toHaveCount(0);
    const confirmed = await fetchCurrentUser(request, root, session.token);
    expect(confirmed).toMatchObject({ ...stats, ...expectedPatch });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cafe_user')!))).toMatchObject({ ...stats, ...expectedPatch });
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Profilini aç' })).toBeVisible();
    expect(await fetchCurrentUser(request, root, session.token)).toMatchObject({ ...stats, ...expectedPatch });
  });
}

test('@smoke profile endpoint requires an owned session and rejects unrelated fields', async ({ request, baseURL }) => {
  const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
  const apiRoot = resolveApiBaseUrl(root);
  const session = await provisionUser(request, root, 'fields');
  const endpoint = `${apiRoot}/api/users/${session.user.id}/profile`;
  const headers = { Authorization: `Bearer ${session.token}`, 'X-CSRF-Token': session.csrfToken, Cookie: `csrf_token=${session.csrfToken}` };
  const before = await fetchCurrentUser(request, root, session.token);
  const anonymous = await request.patch(endpoint, { headers: { 'X-CSRF-Token': session.csrfToken, Cookie: `csrf_token=${session.csrfToken}` }, data: { department: 'İşletme' } });
  expect(anonymous.status()).toBe(401);
  const missingCsrf = await request.patch(endpoint, { headers: { Authorization: `Bearer ${session.token}`, Cookie: '' }, data: { department: 'İşletme' } });
  expect(missingCsrf.status()).toBe(403);
  const preflight = await request.fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'PATCH' } });
  expect(preflight.headers()['access-control-allow-methods']).toContain('PATCH');
  const denied = await request.patch(`${apiRoot}/api/users/0/profile`, { headers, data: { department: 'İşletme' } });
  expect(denied.status()).toBe(403);
  const invalid = await request.patch(endpoint, { headers, data: { department: 'İşletme', points: 0 } });
  expect(invalid.status()).toBe(400);
  expect(await fetchCurrentUser(request, root, session.token)).toMatchObject({ points: before.points, wins: before.wins, gamesPlayed: before.gamesPlayed, department: before.department });
});
