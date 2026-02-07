import { test, expect } from '@playwright/test';
import {
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
} from './helpers/session';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe('Game Flow & Multiplayer Integrity', () => {
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

    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-points"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="user-wins"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="user-games"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="create-game-button"]')).toBeEnabled();
  });

  test('enforces join race safely and keeps consistent winner resolution', async ({ request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const host = await provisionUser(request, root, 'host');
    const guest = await provisionUser(request, root, 'guest');
    const intruder = await provisionUser(request, root, 'intruder');

    await checkInUser(request, root, host.token, { tableNumber: 5 });
    await checkInUser(request, root, guest.token, { tableNumber: 5 });
    await checkInUser(request, root, intruder.token, { tableNumber: 5 });

    const createRes = await request.post(`${root}/api/games`, {
      headers: authHeader(host.token),
      data: {
        hostName: host.user.username,
        gameType: 'Refleks Avı',
        points: 40,
        table: 'MASA05',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdGame = await createRes.json();
    const gameId = createdGame.id;
    expect(gameId).toBeTruthy();

    const [joinGuestRes, joinIntruderRes] = await Promise.all([
      request.post(`${root}/api/games/${gameId}/join`, {
        headers: authHeader(guest.token),
        data: { guestName: guest.user.username },
      }),
      request.post(`${root}/api/games/${gameId}/join`, {
        headers: authHeader(intruder.token),
        data: { guestName: intruder.user.username },
      }),
    ]);

    const joinStatuses = [joinGuestRes.status(), joinIntruderRes.status()].sort();
    expect(joinStatuses).toEqual([200, 409]);

    const joinedPlayer = joinGuestRes.status() === 200 ? guest : intruder;
    const rejectedPlayer = joinGuestRes.status() === 200 ? intruder : guest;

    const rejectedScoreRes = await request.post(`${root}/api/games/${gameId}/move`, {
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

    const hostScoreRes = await request.post(`${root}/api/games/${gameId}/move`, {
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

    const joinedScoreRes = await request.post(`${root}/api/games/${gameId}/move`, {
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
    const finishRes = await request.post(`${root}/api/games/${gameId}/finish`, {
      headers: authHeader(joinedPlayer.token),
      data: { winner: rejectedPlayer.user.username },
    });
    const finishBody = await finishRes.json();
    expect(finishRes.ok(), `finish failed: ${JSON.stringify(finishBody)}`).toBeTruthy();
    expect(finishBody.winner).toBe(host.user.username);

    const gameStateRes = await request.get(`${root}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(gameStateRes.ok()).toBeTruthy();
    const gameState = await gameStateRes.json();
    expect(gameState.status).toBe('finished');
    expect(gameState.gameState?.resolvedWinner).toBe(host.user.username);
  });
});
