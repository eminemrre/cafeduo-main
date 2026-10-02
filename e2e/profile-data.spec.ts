import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser, bootstrapAuthenticatedPage, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

async function openDashboard(page: Page, request: APIRequestContext, root: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = await provisionUser(request, root, 'profile');
  await checkInUser(request, root, session.token, { tableNumber: 7, csrfToken: session.csrfToken });
  const user = await fetchCurrentUser(request, root, session.token);
  await bootstrapAuthenticatedPage(page, root, session, { checkedIn: true, userOverride: user, skipCheckInRecovery: true });
  await expect(page.getByTestId('dashboard-tab-games')).toBeVisible();
}
const entries = [
  { id: 701, gameType: 'Nişancı Düellosu', points: 50, status: 'finished', table: 'MASA07', opponentName: 'deniz', winner: 'self', didWin: true, createdAt: '2026-10-02T09:00:00Z' },
  { id: 702, gameType: 'Bilgi Yarışı', points: 20, status: 'finished', table: 'MASA07', opponentName: 'ege', winner: 'ege', didWin: false, createdAt: '2026-10-01T09:00:00Z' },
  { id: 703, gameType: 'Retro Satranç', points: 0, status: 'finished', table: 'MASA07', opponentName: 'ada', winner: null, didWin: false, createdAt: '2026-09-30T09:00:00Z' },
  { id: 704, gameType: 'Dördüncü oyun', points: 0, status: 'finished', table: 'MASA07', opponentName: 'fourth', winner: null, didWin: false, createdAt: '2026-09-29T09:00:00Z' },
];
const inventory = [{ id: 1, user_id: 7, item_id: 1, item_title: 'Kahve çerçevesi', code: 'not-shown', is_used: false }];
const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) });

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`@smoke real profile activity fits ${viewport.width}x${viewport.height}`, async ({ page, request, baseURL, browserName }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/users/*/game-history', route => route.fulfill(json(entries)));
    await page.route('**/api/store/inventory', route => route.fulfill(json({ success: true, inventory })));
    await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
    await page.getByRole('button', { name: 'Profilini aç' }).click();
    const profile = page.getByRole('dialog', { name: /profili$/ });
    const history = profile.getByRole('region', { name: 'Son oyunların' });
    await expect(history.getByRole('listitem')).toHaveCount(3);
    for (const text of ['Galibiyet', 'Mağlubiyet', 'Beraberlik', 'Rakip: deniz']) await expect(history.getByText(text, { exact: true })).toBeVisible();
    await expect(history.getByText('Dördüncü oyun')).toHaveCount(0);
    await expect(profile.getByRole('region', { name: 'Envanterin' })).toContainText('Kahve çerçevesi');
    await expect(history.locator('time').first()).toHaveAttribute('datetime', '2026-10-02T09:00:00.000Z');
    const last = history.getByRole('listitem').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const bounds = await profile.locator('.max-w-md').boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(await profile.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: `../../outputs/profile-data-${viewport.width}x${viewport.height}-${browserName}.png` });
    await page.keyboard.press('Escape');
    await expect(profile).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Profilini aç' })).toBeFocused();
  });
}

test('@smoke profile loading and errors support independent keyboard retries', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  await expect(page.getByText('İlk oyunundan sonra sonuçlarını burada görebilirsin.').first()).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>(done => { release = done; });
  let historyAttempts = 0, inventoryAttempts = 0;
  await page.route('**/api/users/*/game-history', async route => {
    historyAttempts++;
    if (historyAttempts === 1) { await pending; await route.fulfill({ status: 503, ...json({ error: 'History unavailable' }) }); }
    else await route.fulfill(json(entries));
  });
  await page.route('**/api/store/inventory', route => {
    inventoryAttempts++;
    return route.fulfill(json(inventoryAttempts === 1 ? { success: false, inventory: [] } : { success: true, inventory }));
  });
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  const history = profile.getByRole('region', { name: 'Son oyunların' });
  const store = profile.getByRole('region', { name: 'Envanterin' });
  await expect(history.getByRole('status')).toHaveText('Oyun geçmişi yükleniyor…');
  await expect(store.getByRole('alert')).toHaveText('Envanter yüklenemedi.');
  release();
  await expect(history.getByRole('alert')).toHaveText('Oyun geçmişi yüklenemedi.');
  await history.getByRole('button', { name: 'Oyun geçmişini yeniden yükle' }).focus();
  await page.keyboard.press('Enter');
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await expect(history).toBeFocused();
  expect(inventoryAttempts).toBe(1);
  await store.getByRole('button', { name: 'Envanteri yeniden yükle' }).focus();
  await page.keyboard.press('Enter');
  await expect(store).toContainText('Kahve çerçevesi');
  await expect(store).toBeFocused();
  expect(historyAttempts).toBe(2);
});

test('@smoke an opponent profile never reuses personal inventory or fabricated zero stats', async ({ page, request, baseURL }) => {
  let inventoryReads = 0, opponentHistoryReads = 0;
  await page.route('**/api/store/inventory', route => { inventoryReads++; return route.fulfill(json({ success: true, inventory })); });
  await page.route('**/api/users/*/game-history', route => { if (route.request().url().includes('rakip_oyuncu')) opponentHistoryReads++; return route.fulfill(json(entries)); });
  await page.route(/\/api\/games(?:\?.*)?$/, route => route.request().method() === 'GET' ? route.fulfill(json([{ id: 900, hostName: 'rakip_oyuncu', gameType: 'Retro Satranç', points: 0, table: 'MASA07', status: 'waiting' }])) : route.continue());
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  const own = page.getByRole('dialog', { name: /profili$/ });
  await expect(own.getByRole('region', { name: 'Envanterin' })).toContainText('Kahve çerçevesi');
  await own.getByRole('button', { name: 'Profili kapat' }).click();
  await page.getByRole('button', { name: 'rakip_oyuncu', exact: true }).click();
  const other = page.getByRole('dialog', { name: 'rakip_oyuncu profili' });
  await expect(other).toContainText('Bu oyuncunun ayrıntılı profili paylaşılmıyor.');
  for (const text of ['Kahve çerçevesi', 'ID: #000000', 'LEVEL 1', 'Galibiyet']) await expect(other.getByText(text, { exact: true })).toHaveCount(0);
  await expect(other.getByRole('region', { name: 'Envanterin' })).toHaveCount(0);
  await expect(other.getByRole('button', { name: 'Avatar seç' })).toHaveCount(0);
  expect(inventoryReads).toBe(1);
  expect(opponentHistoryReads).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'rakip_oyuncu', exact: true })).toBeFocused();
});

test('@smoke a new account shows real empty history and truthful inventory availability', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  const inventoryResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/store/inventory'));
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  await expect(profile.getByRole('region', { name: 'Son oyunların' })).toContainText('İlk oyunundan sonra sonuçlarını burada görebilirsin.');
  const response = await inventoryResponse;
  const data = await response.json();
  const inventoryRegion = profile.getByRole('region', { name: 'Envanterin' });
  if (response.ok() && data.success === true) await expect(inventoryRegion).toContainText('Henüz envanterinde bir ürün yok.');
  else await expect(inventoryRegion.getByRole('alert')).toHaveText('Envanter yüklenemedi.');
  await expect(profile.getByText('Son Aktivite')).toHaveCount(0);
  await expect(profile.getByText('+50')).toHaveCount(0);
});
