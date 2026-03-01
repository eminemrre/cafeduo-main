import { test, expect } from '@playwright/test';
import {
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}`, Cookie: '' });

test.describe('Game Flow & Multiplayer Integrity', () => {
  test('blocks unauthenticated and non-checkin game creation attempts', async ({ request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const noAuthRes = await request.post(`${apiRoot}/api/games`, {
      data: {
        hostName: 'spoofed-user',
        gameType: 'Refleks Avı',
        points: 10,
        table: 'MASA01',
      },
    });
    expect(noAuthRes.status()).toBe(401);

    const session = await provisionUser(request, root, 'guard_create');
    const withoutCheckInRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(session.token),
      data: {
        hostName: 'spoofed-user',
        gameType: 'Refleks Avı',
        points: 10,
        table: 'MASA01',
      },
    });
    expect(withoutCheckInRes.status()).toBe(403);
  });

  test('forces check-in before dashboard for regular users', async ({ page, request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const session = await provisionUser(request, root, 'checkin_guard');

    await bootstrapAuthenticatedPage(page, root, session, { checkedIn: false });
    await expect(page.getByText('Kafe Giriş')).toBeVisible();
  });

  test('shows dashboard + stats after authenticated check-in', async ({ page, request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const session = await provisionUser(request, root, 'dashboard_ready');

    await checkInUser(request, root, session.token, { tableNumber: 3 });
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

  test('enforces join race safely and keeps consistent winner resolution', async ({ request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);
    const host = await provisionUser(request, root, 'host');
    const guest = await provisionUser(request, root, 'guest');
    const intruder = await provisionUser(request, root, 'intruder');

    await checkInUser(request, root, host.token, { tableNumber: 5 });
    await checkInUser(request, root, guest.token, { tableNumber: 5 });
    await checkInUser(request, root, intruder.token, { tableNumber: 5 });

    const createRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(host.token),
      data: {
        hostName: host.credentials.username,
        gameType: 'Refleks Avı',
        points: 0,
        table: 'MASA05',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdGame = await createRes.json();
    const gameId = createdGame.id;
    expect(gameId).toBeTruthy();

    const [joinGuestRes, joinIntruderRes] = await Promise.all([
      request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeader(guest.token),
        data: { guestName: guest.credentials.username },
      }),
      request.post(`${apiRoot}/api/games/${gameId}/join`, {
        headers: authHeader(intruder.token),
        data: { guestName: intruder.credentials.username },
      }),
    ]);

    const joinStatuses = [joinGuestRes.status(), joinIntruderRes.status()].sort();
    expect(joinStatuses).toEqual([200, 409]);

    const joinedPlayer = joinGuestRes.status() === 200 ? guest : intruder;
    const rejectedPlayer = joinGuestRes.status() === 200 ? intruder : guest;

    const rejectedScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(rejectedPlayer.token),
      data: {
        scoreSubmission: {
          username: rejectedPlayer.user.username,
          score: 9999,
          roundsWon: 9999,
          durationMs: 1,
        },
      },
    });
    expect(rejectedScoreRes.status()).toBe(403);

    const hostScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(host.token),
      data: {
        scoreSubmission: {
          username: host.user.username,
          score: 6,
          roundsWon: 3,
          durationMs: 9000,
        },
      },
    });
    expect(hostScoreRes.ok()).toBeTruthy();

    const joinedScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(joinedPlayer.token),
      data: {
        scoreSubmission: {
          username: joinedPlayer.user.username,
          score: 4,
          roundsWon: 2,
          durationMs: 8500,
        },
      },
    });
    expect(joinedScoreRes.ok()).toBeTruthy();

    // winner param manipülasyonu yapılsa bile backend sonuç tablosundan doğru kazananı seçmeli
    const finishRes = await request.post(`${apiRoot}/api/games/${gameId}/finish`, {
      headers: authHeader(joinedPlayer.token),
      data: { winner: rejectedPlayer.user.username },
    });
    const finishBody = await finishRes.json();
    expect(finishRes.ok(), `finish failed: ${JSON.stringify(finishBody)}`).toBeTruthy();
    expect(finishBody.winner).toBe(host.user.username);

    const gameStateRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(gameStateRes.ok()).toBeTruthy();
    const gameState = await gameStateRes.json();
    expect(gameState.status).toBe('finished');
    expect(gameState.gameState?.resolvedWinner).toBe(host.user.username);
  });
});
