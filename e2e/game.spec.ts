import { test, expect } from '@playwright/test';
import {
  DEFAULT_E2E_APP_BASE_URL,
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

const authHeader = (token: string, csrfToken?: string) => ({
  Authorization: `Bearer ${token}`,
  ...(csrfToken ? { 'X-CSRF-Token': csrfToken, Cookie: `csrf_token=${csrfToken}` } : { Cookie: '' }),
});

test.describe('Game Flow & Multiplayer Integrity', () => {
  test('@smoke blocks unauthenticated and non-checkin game creation attempts', async ({ request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const noAuthRes = await request.post(`${apiRoot}/api/games`, {
      data: {
        hostName: 'spoofed-user',
        gameType: 'Nişancı Düellosu',
        points: 10,
        table: 'MASA01',
      },
    });
    // Unauthenticated POST requests return 403 (CSRF forbidden) instead of 401
    expect(noAuthRes.status()).toBeGreaterThanOrEqual(401);

    const session = await provisionUser(request, root, 'guard_create');
    const withoutCheckInRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(session.token),
      data: {
        hostName: 'spoofed-user',
        gameType: 'Nişancı Düellosu',
        points: 10,
        table: 'MASA01',
      },
    });
    expect(withoutCheckInRes.status()).toBe(403);
  });

  test('@smoke forces check-in before dashboard for regular users', async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const session = await provisionUser(request, root, 'checkin_guard');

    await bootstrapAuthenticatedPage(page, root, session, { checkedIn: false });
    await expect(page.getByText('Kafeye Giriş')).toBeVisible();
  });

  test('@smoke shows dashboard + stats after authenticated check-in', async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const session = await provisionUser(request, root, 'dashboard_ready');

    await checkInUser(request, root, session.token, { tableNumber: 3, csrfToken: session.csrfToken });
    const user = await fetchCurrentUser(request, root, session.token);

    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: user,
    });

    await expect(page.getByRole('button', { name: /OYUNLAR/i })).toBeVisible();
    await expect(page.getByTestId('user-points')).toBeVisible();
    await expect(page.getByTestId('user-wins')).toBeVisible();
    await expect(page.getByTestId('user-games')).toBeVisible();
    await expect(page.getByRole('button', { name: /Oyun Kur/i })).toBeEnabled();
  });

  test('@advanced enforces join race safely and rejects client-written results', async ({ request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);
    const host = await provisionUser(request, root, 'host');
    const guest = await provisionUser(request, root, 'guest');
    const intruder = await provisionUser(request, root, 'intruder');

    await checkInUser(request, root, host.token, { tableNumber: 5, csrfToken: host.csrfToken });
    await checkInUser(request, root, guest.token, { tableNumber: 5, csrfToken: guest.csrfToken });
    await checkInUser(request, root, intruder.token, { tableNumber: 5, csrfToken: intruder.csrfToken });

    const createRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        hostName: host.credentials.username,
        gameType: 'Retro Satranç',
        points: 0,
        table: 'MASA05',
        chessClock: { baseSeconds: 180, incrementSeconds: 2 },
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdGame = await createRes.json();
    const gameId = createdGame.id;
    expect(gameId).toBeTruthy();

    const [joinGuestRes, joinIntruderRes] = await Promise.all([
      request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeader(guest.token, guest.csrfToken),
        data: { guestName: guest.credentials.username },
      }),
      request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeader(intruder.token, intruder.csrfToken),
        data: { guestName: intruder.credentials.username },
      }),
    ]);

    const joinStatuses = [joinGuestRes.status(), joinIntruderRes.status()].sort();
    expect(joinStatuses).toEqual([200, 409]);

    const joinedPlayer = joinGuestRes.status() === 200 ? guest : intruder;

    // The legacy score/winner path is closed even for chess; a client cannot
    // turn a join race into a balance change through /move or /finish.
    for (const payload of [
      {
        scoreSubmission: {
          username: host.user.username,
          score: 9999,
          roundsWon: 9999,
          durationMs: 1,
        },
      },
      { move: 'e2e4' },
    ]) {
      const rejectedWrite = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
        headers: authHeader(host.token, host.csrfToken),
        data: payload,
      });
      expect(rejectedWrite.status()).toBe(410);
      expect((await rejectedWrite.json()).code).toBe('LEGACY_PROTOCOL_DISABLED');
    }

    const finishRes = await request.post(`${apiRoot}/api/games/${gameId}/finish`, {
      headers: authHeader(joinedPlayer.token, joinedPlayer.csrfToken),
      data: { winner: joinedPlayer.user.username },
    });
    expect(finishRes.status()).toBe(410);
    expect((await finishRes.json()).code).toBe('LEGACY_PROTOCOL_DISABLED');

    const gameStateRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(gameStateRes.ok()).toBeTruthy();
    const gameState = await gameStateRes.json();
    expect(gameState.status).toBe('active');
    expect(gameState.winner).toBeNull();
    expect(gameState.gameState?.resolvedWinner).toBeUndefined();
  });
});
