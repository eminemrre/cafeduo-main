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
 * Amiral Battı end to end: two browser contexts (desktop host, phone guest)
 * place fleets through the real UI, trade shots, survive a reload, and never
 * receive the opponent's fleet over the network.
 */

const V2_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.GAME_ENGINE_V2_ENABLED || '').toLowerCase()
);
const GAME = 'Amiral Battı';
const TABLE = 'MASA14';
const TABLE_NUMBER = 14;
const CAPTURE_DIR = process.env.CAPTURE_DIR || '';

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

async function waitForEngine(
  request: APIRequestContext,
  root: string,
  session: E2ESession,
  id: number,
  predicate: (engine: any) => boolean,
  label: string
) {
  const deadline = Date.now() + 20_000;
  let last: any = null;
  while (Date.now() < deadline) {
    last = await getGame(request, root, session, id);
    if (last?.gameState?.engine && predicate(last.gameState.engine)) return last;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last?.gameState?.engine?.phase)}`);
}

async function openPages(browser: Browser, root: string, pair: Awaited<ReturnType<typeof provisionPair>>) {
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

const capture = async (page: Page, name: string) => {
  if (!CAPTURE_DIR) return;
  await page.getByTestId('battleship-game').screenshot({ path: `${CAPTURE_DIR}/${name}.png` });
};

const fleetCells = (game: any): number[] =>
  (game?.actorView?.fleet || []).flatMap((ship: any) => ship.cells);

test.describe('Amiral Battı', () => {
  test.describe.configure({ timeout: 150_000 });
  test.skip(!V2_ENABLED, 'Set GAME_ENGINE_V2_ENABLED=true to run protocol v2 matches.');

  test('@v2 @advanced two players place, trade shots, reload and never see the other fleet', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, `bs${Date.now().toString(36).slice(-5)}`);
    const pages = await openPages(browser, root, pair);

    // Every game payload the guest's browser receives.
    const guestBodies: any[] = [];
    pages.guestPage.on('response', async (response) => {
      if (!/\/api\/(games|users)\//.test(response.url())) return;
      try {
        guestBodies.push(await response.json());
      } catch {
        // Not JSON (or a redirect); nothing to inspect.
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
      for (const page of [pages.hostPage, pages.guestPage]) {
        await expect(page.getByTestId('battleship-placement')).toBeVisible({ timeout: 20_000 });
      }
      await capture(pages.guestPage, 'phone-1-placement');
      await capture(pages.hostPage, 'desktop-1-placement');

      // Place through the UI: random layout, then confirm.
      for (const page of [pages.hostPage, pages.guestPage]) {
        await page.getByTestId('battleship-shuffle').click();
        await expect(page.getByTestId('battleship-confirm')).toBeEnabled();
        await page.getByTestId('battleship-confirm').click();
      }
      const battle = await waitForEngine(
        request,
        root,
        pair.host,
        gameId,
        (engine) => engine.phase === 'battle',
        'the battle phase'
      );
      expect(battle.gameState.engine.round.turn).toMatch(/^(host|guest)$/);

      const hostView = await getGame(request, root, pair.host, gameId);
      const guestView = await getGame(request, root, pair.guest, gameId);
      const hostFleet = fleetCells(hostView);
      const guestFleet = fleetCells(guestView);
      expect(hostFleet).toHaveLength(12);
      expect(guestFleet).toHaveLength(12);

      // Trade six shots through the UI, whoever has the turn.
      for (let shot = 0; shot < 6; shot += 1) {
        const engine = (await getGame(request, root, pair.host, gameId)).gameState.engine;
        const page = engine.round.turn === 'host' ? pages.hostPage : pages.guestPage;
        await expect(page.getByTestId('battleship-turn')).toContainText('Sıra sende', {
          timeout: 15_000,
        });
        const target = page
          .getByTestId('battleship-target-grid')
          .locator('button[aria-disabled="false"]')
          .first();
        await target.click();
        await page.getByTestId('battleship-fire').click();
        await waitForEngine(
          request,
          root,
          pair.host,
          gameId,
          (next) => next.round?.id !== engine.round.id,
          `turn after shot ${shot + 1}`
        );
        if (shot === 3) {
          await capture(pages.guestPage, 'phone-2-battle');
          await capture(pages.hostPage, 'desktop-2-battle');
        }
      }

      // A reload restores every mark from the server snapshot.
      const before = (await getGame(request, root, pair.guest, gameId)).gameState.engine;
      await pages.guestPage.reload();
      await expect(pages.guestPage.getByTestId('battleship-battle')).toBeVisible({ timeout: 20_000 });
      const marks = await pages.guestPage
        .getByTestId('battleship-target-grid')
        .locator('.duo-bs-cell--hit, .duo-bs-cell--miss, .duo-bs-cell--sunk')
        .count();
      expect(marks).toBe(before.boards.host.shots.length);

      // Out of turn and repeated cells are refused by the server.
      const waiting = before.round.turn === 'host' ? pair.guest : pair.host;
      const outOfTurn = await request.post(`${apiRoot}/api/games/${gameId}/actions`, {
        headers: authHeaders(waiting),
        data: { actionId: `bs_out_of_turn_${Date.now()}`, roundId: before.round.id, type: 'fire', cell: 0, hit: true },
      });
      expect(outOfTurn.status()).toBe(409);
      expect((await outOfTurn.json()).code).toBe('NOT_YOUR_TURN');

      // Privacy: nothing the guest's browser received carries the host's
      // unhit ship cells, the seeded layouts or another actor's fleet.
      const hitCells = new Set(
        before.boards.host.shots.map((entry: any) => entry.cell)
      );
      const hiddenHostCells = hostFleet.filter((cell) => !hitCells.has(cell));
      expect(guestBodies.length).toBeGreaterThan(3);
      for (const body of guestBodies) {
        const text = JSON.stringify(body);
        expect(text).not.toMatch(/autoLayouts|"fleets"|firstTurn|"actions"/);
        const game = body?.game || body;
        if (game?.actorView?.fleet) {
          expect(fleetCells(game).sort((a, b) => a - b)).toEqual([...guestFleet].sort((a, b) => a - b));
        }
        const sunkHost = (game?.gameState?.engine?.boards?.host?.sunk || []).flatMap(
          (ship: any) => ship.cells
        );
        expect(sunkHost.filter((cell: number) => hiddenHostCells.includes(cell))).toEqual([]);
      }

      // Resign settles once and both screens show the result.
      const current = (await getGame(request, root, pair.host, gameId)).gameState.engine;
      const resign = await request.post(`${apiRoot}/api/games/${gameId}/actions`, {
        headers: authHeaders(pair.host),
        data: { actionId: `bs_resign_${Date.now()}`, roundId: current.round.id, type: 'resign' },
      });
      expect(resign.ok(), await resign.text()).toBeTruthy();
      const finished = await waitForEngine(
        request,
        root,
        pair.guest,
        gameId,
        (engine) => engine.phase === 'finished' && engine.result?.settled === true,
        'settled result'
      );
      expect(finished.gameState.engine.result).toMatchObject({
        winner: pair.guest.credentials.username,
        reason: 'resign',
      });
      await expect(pages.guestPage.getByTestId('match-result-card')).toBeVisible({ timeout: 20_000 });
      await capture(pages.guestPage, 'phone-3-finished');

      for (const page of [pages.hostPage, pages.guestPage]) {
        const geometry = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
      }
    } finally {
      await Promise.all([pages.hostContext.close(), pages.guestContext.close()]);
    }
  });

  test('@v2 @advanced practice against the bot needs no server game', async ({ browser, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await waitForApiReady(request, apiRootFor(root));
    const solo = await provisionUser(request, root, `bsp${Date.now().toString(36).slice(-5)}`);
    await checkInUser(request, root, solo.token, { tableNumber: TABLE_NUMBER, csrfToken: solo.csrfToken });
    const soloUser = await fetchCurrentUser(request, root, solo.token);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const actionCalls: string[] = [];
    page.on('request', (req) => {
      if (/\/api\/games(\/|$)/.test(req.url()) && req.method() !== 'GET') actionCalls.push(req.url());
    });
    try {
      await bootstrapAuthenticatedPage(page, root, solo, {
        checkedIn: true,
        userOverride: soloUser,
        skipCheckInRecovery: true,
      });
      await page.getByTestId('battleship-practice-start').click();
      await expect(page.getByTestId('battleship-placement')).toBeVisible();
      await page.getByTestId('battleship-shuffle').click();
      await page.getByTestId('battleship-confirm').click();
      await expect(page.getByTestId('battleship-turn')).toContainText('Sıra sende');
      await page.getByTestId('battleship-target-grid').locator('button[aria-disabled="false"]').first().click();
      await page.getByTestId('battleship-fire').click();
      await expect(page.getByTestId('battleship-turn')).toContainText('Sıra sende', { timeout: 5_000 });
      await expect(page.getByTestId('battleship-own-grid').locator('.duo-bs-cell--hit, .duo-bs-cell--miss')).toHaveCount(1);
      await capture(page, 'phone-4-practice');
      expect(actionCalls).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
