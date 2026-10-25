import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  DEFAULT_E2E_APP_BASE_URL,
  bootstrapAuthenticatedPage,
  checkInUser,
  fetchCurrentUser,
  provisionUser,
  resolveApiBaseUrl,
  waitForApiReady,
  type E2ESession,
} from './helpers/session';

/**
 * Çiz Bil end to end: the desktop host draws with the mouse, the phone guest
 * sees the strokes live over Socket.IO, gets them back after a reload from the
 * replay endpoint, guesses wrong (the drawer sees it) and then right. The
 * guest never receives the word before the round closes.
 */

const V2_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.GAME_ENGINE_V2_ENABLED || '').toLowerCase()
);
const GAME = 'Çiz Bil';
const TABLE = 'MASA16';
const TABLE_NUMBER = 16;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const apiRootFor = (baseURL?: string) => resolveApiBaseUrl(baseURL || DEFAULT_E2E_APP_BASE_URL);
const authHeaders = (session: E2ESession) => ({
  Authorization: `Bearer ${session.token}`,
  'X-CSRF-Token': session.csrfToken,
  Cookie: `csrf_token=${session.csrfToken}`,
});

async function provisionPair(request: APIRequestContext, root: string, prefix: string) {
  const host = await provisionUser(request, root, prefix);
  const guest = await provisionUser(request, root, `${prefix}g`);
  for (const session of [host, guest]) {
    await checkInUser(request, root, session.token, { tableNumber: TABLE_NUMBER, csrfToken: session.csrfToken });
  }
  const [hostUser, guestUser] = await Promise.all([
    fetchCurrentUser(request, root, host.token),
    fetchCurrentUser(request, root, guest.token),
  ]);
  return { host, guest, hostUser, guestUser };
}

async function openPages(browser: Browser, root: string, pair: Awaited<ReturnType<typeof provisionPair>>) {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  await Promise.all([
    bootstrapAuthenticatedPage(hostPage, root, pair.host, {
      checkedIn: true,
      userOverride: pair.hostUser,
      skipCheckInRecovery: true,
    }),
    bootstrapAuthenticatedPage(guestPage, root, pair.guest, {
      checkedIn: true,
      userOverride: pair.guestUser,
      skipCheckInRecovery: true,
    }),
  ]);
  return { hostContext, guestContext, hostPage, guestPage };
}

/** Non-white pixels on the board: the drawing has arrived. */
const inkOn = (page: Page) =>
  page.getByTestId('draw-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 200 && data[i + 1] < 200) count += 1;
    return count;
  });

test.describe('Çiz Bil', () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!V2_ENABLED, 'Set GAME_ENGINE_V2_ENABLED=true to run protocol v2 matches.');

  test('@v2 @advanced the drawer draws, the guesser sees it live and after a reload, then guesses', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, `dr${Date.now().toString(36).slice(-5)}`);
    const pages = await openPages(browser, root, pair);
    const guestBodies: string[] = [];
    pages.guestPage.on('response', async (response) => {
      if (!/\/api\/games\//.test(response.url())) return;
      try {
        guestBodies.push(await response.text());
      } catch {
        // Not readable; nothing to inspect.
      }
    });

    try {
      const created = await request.post(`${apiRoot}/api/games`, {
        headers: authHeaders(pair.host),
        data: { hostName: pair.host.credentials.username, gameType: GAME, points: 0, table: TABLE },
      });
      expect(created.status(), await created.text()).toBe(201);
      const gameId = Number((await created.json()).id);
      const joined = await request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeaders(pair.guest),
        data: { guestName: pair.guest.credentials.username },
      });
      expect(joined.ok(), await joined.text()).toBeTruthy();

      await Promise.all([pages.hostPage.reload(), pages.guestPage.reload()]);
      const host = pages.hostPage.getByTestId('draw-game');
      const guest = pages.guestPage.getByTestId('draw-game');
      await expect(host).toHaveAttribute('data-phase', 'choosing', { timeout: 20_000 });
      await expect(host).toHaveAttribute('data-role', 'drawer');
      await expect(guest).toHaveAttribute('data-role', 'guesser');
      await expect(pages.guestPage.getByTestId('draw-waiting')).toBeVisible();

      await pages.hostPage.getByTestId('draw-choice-0').click();
      await expect(host).toHaveAttribute('data-phase', 'drawing');
      const word = (await pages.hostPage.getByTestId('draw-word').textContent())?.trim() || '';
      expect(word).toMatch(/^[a-zçğıöşü]{3,12}$/);
      await expect(guest).toHaveAttribute('data-phase', 'drawing', { timeout: 10_000 });
      await expect(pages.guestPage.getByTestId('draw-hint').locator('li')).toHaveCount([...word].length);

      // The host draws a zigzag with the mouse.
      const box = (await pages.hostPage.getByTestId('draw-canvas').boundingBox())!;
      await pages.hostPage.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
      await pages.hostPage.mouse.down();
      for (let i = 1; i <= 12; i += 1) {
        await pages.hostPage.mouse.move(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * (i % 2 ? 0.6 : 0.3), {
          steps: 4,
        });
      }
      await pages.hostPage.mouse.up();
      expect(await inkOn(pages.hostPage)).toBeGreaterThan(200);
      await pages.hostPage.screenshot({ path: test.info().outputPath('desktop-drawer.png') });

      // Live over Socket.IO…
      await expect.poll(() => inkOn(pages.guestPage), { timeout: 10_000 }).toBeGreaterThan(200);
      // …and back after a reload, from the replay endpoint.
      await pages.guestPage.reload();
      await expect(guest).toHaveAttribute('data-phase', 'drawing', { timeout: 20_000 });
      await expect.poll(() => inkOn(pages.guestPage), { timeout: 10_000 }).toBeGreaterThan(200);

      // A wrong guess shows up for the drawer; the word has not reached the guest.
      await pages.guestPage.getByLabel(/Tahminin/).fill('zzzz');
      await pages.guestPage.getByRole('button', { name: 'Tahmin et' }).click();
      await expect(pages.hostPage.getByTestId('draw-guesses')).toContainText('zzzz', { timeout: 10_000 });
      expect(guestBodies.join('\n')).not.toContain(`"${word}"`);

      // The right guess closes the round for both and scores the guesser.
      await pages.guestPage.getByLabel(/Tahminin/).fill(word.toLocaleUpperCase('tr-TR'));
      await pages.guestPage.getByRole('button', { name: 'Tahmin et' }).click();
      await expect(guest).toHaveAttribute('data-phase', 'reveal', { timeout: 10_000 });
      await expect(pages.guestPage.getByTestId('draw-reveal')).toContainText(word);
      await expect(pages.hostPage.getByTestId('draw-reveal')).toContainText('bulundu', { timeout: 10_000 });
      await pages.guestPage.screenshot({ path: test.info().outputPath('phone-reveal.png') });

      // Round 2: the roles swap.
      await expect(guest).toHaveAttribute('data-role', 'drawer', { timeout: 15_000 });
      await expect(pages.guestPage.getByTestId('draw-choice-0')).toBeVisible();
      await pages.guestPage.screenshot({ path: test.info().outputPath('phone-choosing.png') });
      await pages.guestPage.getByTestId('draw-choice-2').click();
      await expect(guest).toHaveAttribute('data-phase', 'drawing');
      await pages.guestPage.screenshot({ path: test.info().outputPath('phone-drawer.png'), fullPage: true });
    } finally {
      await Promise.all([pages.hostContext.close(), pages.guestContext.close()]);
      await sleep(50);
    }
  });
});
