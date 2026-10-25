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
 * Adam Asmaca end to end: two browser contexts (desktop host, phone guest)
 * play the same hidden word, each on its own board. Neither page ever
 * receives the word before its round closes, and a reload keeps the board.
 */

const V2_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.GAME_ENGINE_V2_ENABLED || '').toLowerCase()
);
const GAME = 'Adam Asmaca';
const TABLE = 'MASA15';
const TABLE_NUMBER = 15;

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
    await checkInUser(request, root, session.token, {
      tableNumber: TABLE_NUMBER,
      csrfToken: session.csrfToken,
    });
  }
  const [hostUser, guestUser] = await Promise.all([
    fetchCurrentUser(request, root, host.token),
    fetchCurrentUser(request, root, guest.token),
  ]);
  return { host, guest, hostUser, guestUser };
}

async function getGame(request: APIRequestContext, root: string, session: E2ESession, id: number) {
  const res = await request.get(`${apiRootFor(root)}/api/games/${id}`, {
    headers: { Authorization: `Bearer ${session.token}`, Cookie: '' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

async function openPages(
  browser: Browser,
  root: string,
  pair: Awaited<ReturnType<typeof provisionPair>>
) {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
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

/** A letter that is not in the hidden word is only known to the server; pick
 * "ğ" and fall back to others so the test always sends a guess. */
const FIRST_LETTERS = ['a', 'e', 'k', 'ğ', 'ü'];

const key = (page: Page, letter: string) =>
  page.locator(`.duo-hm-key:text-is("${letter}")`).first();

test.describe('Adam Asmaca', () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!V2_ENABLED, 'Set GAME_ENGINE_V2_ENABLED=true to run protocol v2 matches.');

  test('@v2 @advanced two players guess the same word on separate boards and never see it early', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, `hm${Date.now().toString(36).slice(-5)}`);
    const pages = await openPages(browser, root, pair);

    // Every game payload either browser receives while the round is open.
    const bodies: any[] = [];
    for (const page of [pages.hostPage, pages.guestPage]) {
      page.on('response', async (response) => {
        if (!/\/api\/games\//.test(response.url())) return;
        try {
          bodies.push(await response.json());
        } catch {
          // Not JSON; nothing to inspect.
        }
      });
    }

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

      const opened = await getGame(request, root, pair.host, gameId);
      const length = opened.gameState?.engine?.round?.length;
      expect(typeof length).toBe('number');
      expect(length).toBeGreaterThanOrEqual(3);
      expect(length).toBeLessThanOrEqual(12);

      await Promise.all([pages.hostPage.reload(), pages.guestPage.reload()]);
      for (const page of [pages.hostPage, pages.guestPage]) {
        await expect(page.getByTestId('hangman-game')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('hangman-game')).toHaveAttribute('data-phase', 'open');
        await expect(page.getByTestId('hangman-word').locator('li')).toHaveCount(length);
        // 29 keys, no q/w/x: Turkish does not use them.
        await expect(page.locator('.duo-hm-key')).toHaveCount(29);
      }

      // The host guesses one letter through the real keyboard.
      let guessed = false;
      for (const letter of FIRST_LETTERS) {
        const hostKey = key(pages.hostPage, letter);
        if (!(await hostKey.isEnabled())) continue;
        await hostKey.click();
        guessed = true;
        break;
      }
      expect(guessed).toBe(true);

      // The guess lands on the host's own board only.
      await expect(pages.hostPage.locator('.duo-hm-key:disabled')).toHaveCount(1);
      await expect(pages.guestPage.locator('.duo-hm-key:disabled')).toHaveCount(0);

      const hostView = await getGame(request, root, pair.host, gameId);
      const guestView = await getGame(request, root, pair.guest, gameId);
      expect(hostView.actorView?.hangman?.guessed).toHaveLength(1);
      expect(guestView.actorView?.hangman?.guessed).toHaveLength(0);
      expect(hostView.gameState.engine.round.word).toBeUndefined();

      // The guest sees the host's counts, not the host's letters.
      expect(
        hostView.gameState.engine.round.progress.host.revealed +
          hostView.gameState.engine.round.progress.host.wrong
      ).toBeGreaterThan(0);
      expect(
        guestView.gameState.engine.round.progress.host.revealed +
          guestView.gameState.engine.round.progress.host.wrong
      ).toBe(1);

      // A reload keeps the host's own board and still hides the word.
      await pages.hostPage.reload();
      await expect(pages.hostPage.getByTestId('hangman-game')).toHaveAttribute(
        'data-phase',
        'open',
        { timeout: 20_000 }
      );
      await expect(pages.hostPage.locator('.duo-hm-key:disabled')).toHaveCount(1);

      const payloads = JSON.stringify(bodies);
      expect(payloads).not.toMatch(/"boards"|game_private_state|"rounds"/);
      // The word is public only after its round; while open it is absent everywhere.
      expect(payloads).not.toMatch(/"word"\s*:\s*"[a-zçğıöşü]+"/);
    } finally {
      await Promise.all([pages.hostContext.close(), pages.guestContext.close()]);
      await sleep(50);
    }
  });
});
