import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
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

const V2_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.GAME_ENGINE_V2_ENABLED || '').toLowerCase()
);
const QUIZ = 'Bilgi Yarışı';
const AIM = 'Nişancı Düellosu';
const TABLE = 'MASA12';
const TABLE_NUMBER = 12;
const ACTION_TIMEOUT_MS = 20_000;

interface Pair {
  host: E2ESession;
  guest: E2ESession;
  hostUser: any;
  guestUser: any;
}

interface GamePages {
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  hostPage: Page;
  guestPage: Page;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const authHeaders = (session: E2ESession) => ({
  Authorization: `Bearer ${session.token}`,
  'X-CSRF-Token': session.csrfToken,
  Cookie: `csrf_token=${session.csrfToken}`,
});

const actionId = (() => {
  let counter = 0;
  return (prefix: string) => {
    counter += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
  };
})();

const apiRootFor = (baseURL?: string) =>
  resolveApiBaseUrl(baseURL || DEFAULT_E2E_APP_BASE_URL);

async function provisionPair(
  request: APIRequestContext,
  root: string,
  prefix: string
): Promise<Pair> {
  const host = await provisionUser(request, root, prefix);
  const guest = await provisionUser(request, root, `${prefix}g`);
  await checkInUser(request, root, host.token, {
    tableNumber: TABLE_NUMBER,
    csrfToken: host.csrfToken,
  });
  await checkInUser(request, root, guest.token, {
    tableNumber: TABLE_NUMBER,
    csrfToken: guest.csrfToken,
  });
  const [hostUser, guestUser] = await Promise.all([
    fetchCurrentUser(request, root, host.token),
    fetchCurrentUser(request, root, guest.token),
  ]);
  return { host, guest, hostUser, guestUser };
}

async function createAndJoin(
  request: APIRequestContext,
  root: string,
  pair: Pair,
  gameType: string
): Promise<number> {
  const apiRoot = apiRootFor(root);
  const createRes = await request.post(`${apiRoot}/api/games`, {
    headers: authHeaders(pair.host),
    data: {
      hostName: pair.host.credentials.username,
      gameType,
      points: 0,
      table: TABLE,
    },
  });
  expect(createRes.status(), await createRes.text()).toBe(201);
  const created = await createRes.json();
  expect(Number(created.id)).toBeGreaterThan(0);

  const joinRes = await request.post(`${apiRoot}/api/games/${created.id}/join`, {
    headers: authHeaders(pair.guest),
    data: { guestName: pair.guest.credentials.username },
  });
  expect(joinRes.ok(), await joinRes.text()).toBeTruthy();
  const joined = await joinRes.json();
  expect(joined.game?.status).toBe('active');
  return Number(created.id);
}

async function getGame(
  request: APIRequestContext,
  root: string,
  session: E2ESession,
  gameId: number
): Promise<any> {
  const apiRoot = apiRootFor(root);
  const res = await request.get(`${apiRoot}/api/games/${gameId}`, {
    headers: { Authorization: `Bearer ${session.token}`, Cookie: '' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

async function sendAction(
  request: APIRequestContext,
  root: string,
  session: E2ESession,
  gameId: number,
  envelope: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const apiRoot = apiRootFor(root);
  const res = await request.post(`${apiRoot}/api/games/${gameId}/actions`, {
    headers: authHeaders(session),
    timeout: ACTION_TIMEOUT_MS,
    data: envelope,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function waitForEngine(
  request: APIRequestContext,
  root: string,
  session: E2ESession,
  gameId: number,
  predicate: (engine: any, game: any) => boolean,
  label: string,
  timeoutMs = 15_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;
  while (Date.now() < deadline) {
    last = await getGame(request, root, session, gameId);
    const engine = last?.gameState?.engine;
    if (engine && predicate(engine, last)) return last;
    await sleep(100);
  }
  throw new Error(
    `Timed out waiting for ${label}: ${JSON.stringify(
      last?.gameState?.engine
        ? {
            phase: last.gameState.engine.phase,
            round: last.gameState.engine.round?.index,
            players: last.gameState.engine.players,
          }
        : last
    )}`
  );
}

function visibleOption(engine: any): number {
  const hidden = new Set<number>(Array.isArray(engine.round?.hiddenOptions) ? engine.round.hiddenOptions : []);
  const optionCount = Array.isArray(engine.round?.options) ? engine.round.options.length : 4;
  for (let index = 0; index < optionCount; index += 1) {
    if (!hidden.has(index)) return index;
  }
  return 0;
}

async function openPlayerPages(
  browser: Browser,
  root: string,
  pair: Pair,
  options: { guestWebgl?: boolean; guestClockOffset?: number } = {}
): Promise<GamePages> {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  if (options.guestClockOffset) {
    await guestContext.addInitScript((offset) => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + offset;
    }, options.guestClockOffset);
  }
  if (options.guestWebgl === false) {
    await guestContext.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (String(type).toLowerCase().includes('webgl')) return null;
        return (original as any).call(this, type, ...args);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
  }

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
  await Promise.all([
    expect(hostPage.getByTestId('dashboard-tab-games')).toBeVisible({ timeout: 20_000 }),
    expect(guestPage.getByTestId('dashboard-tab-games')).toBeVisible({ timeout: 20_000 }),
  ]);
  return { hostContext, guestContext, hostPage, guestPage };
}

async function enterGame(pages: GamePages, testId: 'knowledge-quiz' | 'arena-battle') {
  // The match starts on join. Reload the already-authenticated pages so the
  // first server round does not spend its 8-15 s budget bootstrapping Vite.
  await Promise.all([pages.hostPage.reload(), pages.guestPage.reload()]);
  await Promise.all([
    expect(pages.hostPage.getByTestId(testId)).toBeVisible({ timeout: 20_000 }),
    expect(pages.guestPage.getByTestId(testId)).toBeVisible({ timeout: 20_000 }),
  ]);
}

async function closeGamePages(pages: GamePages) {
  await Promise.all([pages.hostContext.close(), pages.guestContext.close()]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
}

test.describe('Server-authoritative competitive games', () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!V2_ENABLED, 'Set GAME_ENGINE_V2_ENABLED=true to run protocol v2 matches.');

  test('@v2 @advanced quiz plays ten server rounds with joker, refresh and reconnect', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, 'v2quiz');
    const pages = await openPlayerPages(browser, root, pair);
    const gameId = await createAndJoin(request, root, pair, QUIZ);
    await enterGame(pages, 'knowledge-quiz');

    try {
      const first = await waitForEngine(
        request,
        root,
        pair.host,
        gameId,
        (engine) => engine.phase === 'open' && Boolean(engine.round?.id),
        'the first quiz round'
      );
      const firstRoundId = first.gameState.engine.round.id;

      // The joker must come from the server and hide exactly two wrong options
      // only for its owner. The opponent must spend their own joker.
      await pages.hostPage.getByTestId('knowledge-joker').click();
      const jokerView = await waitForEngine(
        request,
        root,
        pair.host,
        gameId,
        (_engine, game) => game.actorView?.joker?.hiddenOptions?.length === 2,
        'the server joker result'
      );
      expect(jokerView.gameState.engine.round.id).toBe(firstRoundId);
      await expect(
        pages.hostPage.locator('[data-testid^="knowledge-option-"][aria-hidden="true"]')
      ).toHaveCount(2);
      await expect(
        pages.guestPage.locator('[data-testid^="knowledge-option-"][aria-hidden="true"]')
      ).toHaveCount(0);
      const guestBeforeJoker = await getGame(request, root, pair.guest, gameId);
      expect(JSON.stringify(guestBeforeJoker)).not.toContain('hiddenOptions');
      for (const endpoint of [
        `/api/users/${pair.guest.credentials.username}/active-game`,
        `/api/users/${pair.guest.credentials.username}/game-history`,
      ]) {
        const response = await request.get(`${apiRoot}${endpoint}`, { headers: authHeaders(pair.guest) });
        expect(response.ok()).toBe(true);
        expect(await response.text()).not.toContain('hiddenOptions');
      }
      const repeatedJoin = await request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeaders(pair.guest), data: { guestName: pair.guest.credentials.username },
      });
      expect(repeatedJoin.ok()).toBe(true);
      expect(await repeatedJoin.text()).not.toContain('hiddenOptions');
      await pages.guestPage.getByTestId('knowledge-joker').click();
      await expect(
        pages.guestPage.locator('[data-testid^="knowledge-option-"][aria-hidden="true"]')
      ).toHaveCount(2);
      const guestAfterJoker = await getGame(request, root, pair.guest, gameId);
      expect(guestAfterJoker.actorView.joker).toEqual(jokerView.actorView.joker);

      const firstOption = [0, 1, 2, 3].find(index => !jokerView.actorView.joker.hiddenOptions.includes(index))!;
      await Promise.all([
        pages.hostPage.getByTestId(`knowledge-option-${firstOption}`).click(),
        pages.guestPage.getByTestId(`knowledge-option-${firstOption}`).click(),
      ]);
      await waitForEngine(
        request,
        root,
        pair.host,
        gameId,
        (engine) =>
          engine.phase === 'reveal' ||
          (engine.players?.host?.answered === true && engine.players?.guest?.answered === true),
        'the first answered round',
        5_000
      );

      let finalView: any = null;
      let refreshed = false;
      let reconnected = false;
      for (let guard = 0; guard < 120; guard += 1) {
        const view = await getGame(request, root, pair.host, gameId);
        const engine = view.gameState?.engine;
        if (!engine) throw new Error('Server snapshot has no engine');
        if (engine.phase === 'finished') {
          finalView = view;
          break;
        }

        if (engine.phase === 'open' && engine.round?.id) {
          if (engine.round.index === 2 && !refreshed) {
            refreshed = true;
            const question = String(engine.round.question || '');
            await pages.guestPage.reload();
            await expect(pages.guestPage.getByTestId('knowledge-quiz')).toBeVisible({
              timeout: 20_000,
            });
            await expect(pages.guestPage.getByTestId('knowledge-question')).toHaveText(question, {
              timeout: 10_000,
            });
          }

          if (engine.round.index === 3 && !reconnected) {
            reconnected = true;
            await pages.guestContext.setOffline(true);
            await sleep(900);
            await pages.guestContext.setOffline(false);
            await expect(pages.guestPage.getByTestId('knowledge-quiz')).toBeVisible({
              timeout: 15_000,
            });
          }

          const roundId = String(engine.round.id);
          const optionIndex = visibleOption(engine);
          for (const [actor, session] of [
            ['host', pair.host],
            ['guest', pair.guest],
          ] as const) {
            if (engine.players?.[actor]?.answered) continue;
            const result = await sendAction(request, root, session, gameId, {
              actionId: actionId(`quiz_${actor}_${roundId}`),
              roundId,
              type: 'answer',
              optionIndex,
            });
            if (result.status !== 200 && result.status !== 409) {
              throw new Error(`Answer rejected: ${result.status} ${JSON.stringify(result.body)}`);
            }
          }
        }

        await sleep(120);
      }

      expect(finalView, 'quiz should finish within the guard window').toBeTruthy();
      expect(finalView.status).toBe('finished');
      expect(finalView.gameState.engine.result?.settled).toBe(true);
      expect(finalView.gameState.engine.roundIndex).toBe(10);
      expect(finalView.gameState.engine.totalRounds).toBe(10);
      expect(finalView.gameState.engine.players.host.score).toBeLessThanOrEqual(320);
      expect(finalView.gameState.engine.players.guest.score).toBeLessThanOrEqual(320);
      expect(finalView.gameState.engine.players.host.score).toBeGreaterThanOrEqual(0);
      expect(finalView.gameState.engine.players.guest.score).toBeGreaterThanOrEqual(0);

      await expect(pages.hostPage.getByTestId('match-result-card')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pages.guestPage.getByTestId('match-result-card')).toBeVisible({
        timeout: 15_000,
      });
      await expectNoHorizontalOverflow(pages.guestPage);
      await expectNoHorizontalOverflow(pages.hostPage);
    } finally {
      await closeGamePages(pages);
    }
  });

  test('@v2 @advanced aim plays five rounds and works without WebGL', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, 'v2aim');
    const pages = await openPlayerPages(browser, root, pair, { guestWebgl: false });
    const gameId = await createAndJoin(request, root, pair, AIM);
    await enterGame(pages, 'arena-battle');

    try {
      await expect(pages.guestPage.getByTestId('arena-reticle')).toBeVisible({
        timeout: 15_000,
      });

      const roundsSeen = new Set<number>();
      let finalView: any = null;
      let usedHostUiFire = false;
      for (let guard = 0; guard < 100; guard += 1) {
        const view = await getGame(request, root, pair.host, gameId);
        const engine = view.gameState?.engine;
        if (!engine) throw new Error('Server snapshot has no engine');
        if (engine.phase === 'finished') {
          finalView = view;
          break;
        }

        if (engine.phase === 'open' && engine.round?.id) {
          const roundId = String(engine.round.id);
          roundsSeen.add(Number(engine.round.index));

          if (!engine.players?.host?.answered) {
            if (!usedHostUiFire && engine.round.index === 0) {
              // One host action through the real UI button.
              usedHostUiFire = true;
              await expect(pages.hostPage.getByTestId('arena-fire-button')).toBeEnabled({
                timeout: 10_000,
              });
              await pages.hostPage.getByTestId('arena-fire-button').click();
            } else {
              const result = await sendAction(request, root, pair.host, gameId, {
                actionId: actionId(`aim_host_${roundId}`),
                roundId,
                type: 'fire',
              });
              if (result.status !== 200 && result.status !== 409) {
                throw new Error(`Host fire rejected: ${result.status} ${JSON.stringify(result.body)}`);
              }
            }
          }

          if (!engine.players?.guest?.answered) {
            const result = await sendAction(request, root, pair.guest, gameId, {
                actionId: actionId(`aim_guest_${roundId}`),
                roundId,
                type: 'fire',
              });
            if (result.status !== 200 && result.status !== 409) {
              throw new Error(`Guest fire rejected: ${result.status} ${JSON.stringify(result.body)}`);
            }
          }
        }

        await sleep(120);
      }

      expect(finalView, 'aim should finish within the guard window').toBeTruthy();
      expect(finalView.status).toBe('finished');
      expect(finalView.gameState.engine.result?.settled).toBe(true);
      expect(roundsSeen.size).toBe(5);
      expect(finalView.gameState.engine.players.host.score).toBeLessThanOrEqual(15);
      expect(finalView.gameState.engine.players.guest.score).toBeLessThanOrEqual(15);

      await expect(pages.hostPage.getByTestId('match-result-card')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pages.guestPage.getByTestId('match-result-card')).toBeVisible({
        timeout: 15_000,
      });
      await expectNoHorizontalOverflow(pages.guestPage);
      await expectNoHorizontalOverflow(pages.hostPage);
    } finally {
      await closeGamePages(pages);
    }
  });

  for (const rtt of [50, 150, 300]) {
    test(`@v2 @rtt aim measures UI shot with ${rtt} ms symmetric network RTT and clock skew`, async ({ browser, request, baseURL }, testInfo) => {
      const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
      const pair = await provisionPair(request, root, 'rtt');
      const pages = await openPlayerPages(browser, root, pair, { guestWebgl: false, guestClockOffset: 700 });
      const gameId = await createAndJoin(request, root, pair, AIM);
      const timings: Array<{ method: string; path: string; elapsedMs: number }> = [];
      try {
        // Real browser requests are held on BOTH legs. Unlike the old
        // pre-fetch sleep this changes observed RTT and clock calibration.
        await pages.guestPage.route(`**/api/games/${gameId}{,/actions}`, async route => {
          const began = Date.now();
          await sleep(rtt / 2);
          const response = await route.fetch();
          await sleep(rtt / 2);
          await route.fulfill({ response });
          timings.push({ method: route.request().method(), path: new URL(route.request().url()).pathname, elapsedMs: Date.now() - began });
        });
        await enterGame(pages, 'arena-battle');
        await expect(pages.guestPage.getByTestId('arena-reticle')).toBeVisible();
        const snapshot = await getGame(request, root, pair.host, gameId);
        const round = snapshot.gameState.engine.round;
        expect(round.id).toBe('r1');
        expect((await sendAction(request, root, pair.host, gameId, { actionId: actionId('rtt_host'), roundId: round.id, type: 'fire' })).status).toBe(200);
        await pages.guestPage.evaluate(() => {
          document.querySelector('[data-testid="arena-fire-button"]')!.addEventListener('click', () => {
            (window as any).__aimClick = { clientAt: Date.now(), displayedPosition: parseFloat((document.querySelector('[data-testid="arena-reticle"]') as HTMLElement).style.left) };
          }, { capture: true, once: true });
        });
        const button = pages.guestPage.getByTestId('arena-fire-button');
        await expect(button).toBeEnabled();
        await button.scrollIntoViewIfNeeded();
        const box = (await button.boundingBox())!;
        await pages.guestPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await pages.guestPage.waitForFunction(() => {
          const reticle = document.querySelector('[data-testid="arena-reticle"]') as HTMLElement | null;
          // Rendering samples every 46 ms (~4 units). A <1-unit trigger can
          // miss the centre forever even though the 3-point zone was drawn.
          return reticle && Math.abs(parseFloat(reticle.style.left) - 50) <= 2.05;
        }, undefined, { polling: 'raf', timeout: 5000 });
        const responsePromise = pages.guestPage.waitForResponse(response => response.url().endsWith(`/api/games/${gameId}/actions`) && response.request().method() === 'POST', { timeout: 10000 });
        await pages.guestPage.mouse.down();
        await pages.guestPage.mouse.up();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        const body = await response.json();
        const click = await pages.guestPage.evaluate(() => (window as any).__aimClick);
        const shot = body.game.gameState.engine.round.shots.guest;
        const { positionAt, pointsAt, pointsFromDistance } = require('../shared/aimTrajectory');
        const receivedAt = Date.parse(body.game.serverReceivedAt);
        const startedAt = Date.parse(round.startedAt);
        // Lag compensation: the server scores the client's draw time, clamped
        // to 250 ms before receipt and to the round start.
        const shotAt = response.request().postDataJSON().shotAt;
        expect(Number.isSafeInteger(shotAt)).toBe(true);
        const scoredAt = Math.min(receivedAt, Math.max(shotAt, receivedAt - 250, startedAt));
        expect(shot.position).toBeCloseTo(positionAt(round.trajectory, scoredAt - startedAt), 5);
        expect(shot.points).toBe(pointsAt(round.trajectory, scoredAt - startedAt));
        const displayedPoints = pointsFromDistance(Math.abs(click.displayedPosition - 50));
        expect(displayedPoints).toBe(3);
        const clickServerAt = click.clientAt - 700;
        const truePositionAtClick = positionAt(round.trajectory, clickServerAt - Date.parse(round.startedAt));
        const report = { configuredRttMs: rtt, clientClockSkewMs: 700, timings, displayedPosition: click.displayedPosition, truePositionAtClick, displayPositionError: click.displayedPosition - truePositionAtClick, displayedPoints, officialPosition: shot.position, officialPoints: shot.points, pointsDelta: shot.points - displayedPoints, officialMinusDisplayed: shot.position - click.displayedPosition, ingressAfterClickMs: receivedAt - clickServerAt, rewindMs: receivedAt - scoredAt };
        console.log(`AIM_RTT_MEASUREMENT ${JSON.stringify(report)}`);
        await testInfo.attach(`aim-rtt-${rtt}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
        expect(timings.some(timing => timing.method === 'GET' && timing.elapsedMs >= rtt)).toBe(true);
        expect(Number.isFinite(report.displayPositionError)).toBe(true);
        // Playability gate: the client fires at the frame on screen, so the
        // official shot lands where the reticle was drawn (only the integer-ms
        // shot time differs) and a centre shot keeps its 3 points on a slow
        // network.
        expect(Math.abs(report.officialMinusDisplayed)).toBeLessThanOrEqual(0.5);
        expect(shot.points).toBe(3);
      } finally {
        await closeGamePages(pages);
      }
    });
  }

  test('@v2 @advanced rejects forged results, replay conflicts and duplicate jokers', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, 'v2atk');
    const gameId = await createAndJoin(request, root, pair, QUIZ);

    const initial = await waitForEngine(
      request,
      root,
      pair.host,
      gameId,
      (engine) => engine.phase === 'open' && Boolean(engine.round?.id),
      'the attack round'
    );
    const roundId = initial.gameState.engine.round.id;
    const forbidden = JSON.stringify(initial);
    expect(forbidden).not.toContain('gamePrivateState');
    expect(forbidden).not.toContain('answerKey');
    expect(forbidden).not.toContain('questions');
    expect(forbidden).not.toContain('correctIndex');
    expect(initial.gameState.engine.results).toBeUndefined();
    expect(initial.gameState.engine.settlementApplied).toBeUndefined();

    const joker = await sendAction(request, root, pair.host, gameId, {
      actionId: actionId('attack_joker'),
      roundId,
      type: 'joker',
    });
    expect(joker.status).toBe(200);
    const secondJoker = await sendAction(request, root, pair.host, gameId, {
      actionId: actionId('attack_joker_2'),
      roundId,
      type: 'joker',
    });
    expect(secondJoker.status).toBe(409);
    expect(secondJoker.body.code).toBe('JOKER_USED');

    const optionIndex = visibleOption(joker.body.game.gameState.engine);
    const firstActionId = actionId('attack_answer');
    const forged = await sendAction(request, root, pair.host, gameId, {
      actionId: firstActionId,
      roundId,
      type: 'answer',
      optionIndex,
      score: 99999,
      done: true,
      winner: pair.host.credentials.username,
      results: { host: 99999, guest: 0 },
      resolvedWinner: pair.host.credentials.username,
      settlementApplied: true,
    });
    expect(forged.status).toBe(200);
    expect(forged.body.duplicate).toBe(false);
    expect(forged.body.game.gameState.engine.players.host.score).toBeLessThanOrEqual(320);
    expect(forged.body.game.gameState.engine.players.host.score).not.toBe(99999);
    expect(forged.body.game.gameState.engine.results).toBeUndefined();
    expect(forged.body.game.gameState.engine.settlementApplied).toBeUndefined();
    expect(forged.body.game.winner).toBeNull();

    const replay = await sendAction(request, root, pair.host, gameId, {
      actionId: firstActionId,
      roundId,
      type: 'answer',
      optionIndex,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);

    const conflict = await sendAction(request, root, pair.host, gameId, {
      actionId: firstActionId,
      roundId,
      type: 'answer',
      optionIndex: (optionIndex + 1) % 4,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('ACTION_ID_CONFLICT');

    const secondAnswer = await sendAction(request, root, pair.host, gameId, {
      actionId: actionId('attack_answer_2'),
      roundId,
      type: 'answer',
      optionIndex,
    });
    expect(secondAnswer.status).toBe(409);
    expect(secondAnswer.body.code).toBe('ALREADY_ANSWERED');

    const futureRound = await sendAction(request, root, pair.guest, gameId, {
      actionId: actionId('attack_future'),
      roundId: 'r99',
      type: 'answer',
      optionIndex: 0,
    });
    expect(futureRound.status).toBe(409);
    expect(futureRound.body.code).toBe('STALE_ROUND');

    const legacyFinish = await request.post(`${apiRoot}/api/games/${gameId}/finish`, {
      headers: authHeaders(pair.host),
      data: { winner: pair.host.credentials.username },
    });
    expect(legacyFinish.status()).toBe(410);
    expect((await legacyFinish.json()).code).toBe('LEGACY_PROTOCOL_DISABLED');
  });

  test('@v2 @advanced an old cached client is asked to refresh instead of scoring locally', async ({
    browser,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const pair = await provisionPair(request, root, 'v2old');
    const pages = await openPlayerPages(browser, root, pair);
    const gameId = await createAndJoin(request, root, pair, QUIZ);
    await enterGame(pages, 'knowledge-quiz');

    try {
      const legacySnapshot = (route: import('@playwright/test').Route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: gameId,
            hostName: pair.host.credentials.username,
            guestName: pair.guest.credentials.username,
            gameType: QUIZ,
            points: 0,
            table: TABLE,
            status: 'active',
            winner: null,
            protocolVersion: 1,
            gameState: {},
          }),
        });
      await pages.guestPage.route(`**/api/games/${gameId}`, legacySnapshot);
      await pages.guestPage.reload();
      await expect(pages.guestPage.getByText('İstemci güncellemesi gerekiyor')).toBeVisible({
        timeout: 20_000,
      });
      await expect(pages.guestPage.getByRole('button', { name: 'Sayfayı yenile' })).toBeVisible();

      await pages.guestPage.unroute(`**/api/games/${gameId}`, legacySnapshot);
      await pages.guestPage.getByRole('button', { name: 'Sayfayı yenile' }).click();
      await expect(pages.guestPage.getByTestId('knowledge-quiz')).toBeVisible({
        timeout: 20_000,
      });
      await expect(pages.guestPage.getByText('İstemci güncellemesi gerekiyor')).not.toBeVisible();
    } finally {
      await closeGamePages(pages);
    }
  });

  test('@v2 @advanced resign settles once and a missed aim round scores zero', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);

    const timeoutPair = await provisionPair(request, root, 'v2time');
    const timeoutGameId = await createAndJoin(request, root, timeoutPair, AIM);
    const firstAim = await waitForEngine(
      request,
      root,
      timeoutPair.host,
      timeoutGameId,
      (engine) => engine.phase === 'open' && engine.round?.index === 0,
      'the first aim round'
    );
    expect(firstAim.gameState.engine.players.host.score).toBe(0);
    // Aim rounds are 8 s plus 750 ms feedback; the next round opens when the
    // server clock passes both boundaries. Do not answer either player.
    await sleep(9_300);
    const secondAim = await waitForEngine(
      request,
      root,
      timeoutPair.host,
      timeoutGameId,
      (engine) => engine.phase === 'open' && engine.round?.index === 1,
      'the timed-out second aim round',
      5_000
    );
    expect(secondAim.gameState.engine.players.host.score).toBe(0);
    expect(secondAim.gameState.engine.players.guest.score).toBe(0);

    const resign = await sendAction(request, root, timeoutPair.host, timeoutGameId, {
      actionId: actionId('resign_timeout'),
      roundId: secondAim.gameState.engine.round.id,
      type: 'resign',
    });
    expect(resign.status).toBe(200);
    expect(resign.body.game.status).toBe('finished');
    expect(resign.body.game.winner).toBe(timeoutPair.guest.credentials.username);
    expect(resign.body.game.gameState.engine.result).toMatchObject({
      reason: 'resign',
      settled: true,
      stakeTransferred: 0,
    });

    const legacyResign = await request.post(`${apiRoot}/api/games/${timeoutGameId}/resign`, {
      headers: authHeaders(timeoutPair.host),
    });
    expect(legacyResign.status()).toBe(409);
    expect((await legacyResign.json()).code).toBe('USE_ENGINE_ACTION');
  });
});
