import { test, expect } from '@playwright/test';
import {
  DEFAULT_E2E_APP_BASE_URL,
  provisionUser,
  checkInUser,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

const authHeader = (token: string, csrfToken?: string) => ({
  Authorization: `Bearer ${token}`,
  ...(csrfToken ? { 'X-CSRF-Token': csrfToken, Cookie: `csrf_token=${csrfToken}` } : { Cookie: '' }),
});

test.describe('Aim Duel Multiplayer Sync & Settlement', () => {
  test('@advanced resolves aim duel winner from server-side scores despite spoofed finish payload', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const host = await provisionUser(request, root, 'aimhost');
    const guest = await provisionUser(request, root, 'aimguest');
    const intruder = await provisionUser(request, root, 'aimx');

    await checkInUser(request, root, host.token, { tableNumber: 9, csrfToken: host.csrfToken });
    await checkInUser(request, root, guest.token, { tableNumber: 9, csrfToken: guest.csrfToken });
    await checkInUser(request, root, intruder.token, { tableNumber: 9, csrfToken: intruder.csrfToken });

    const createRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        hostName: host.credentials.username,
        gameType: 'Nişancı Düellosu',
        points: 0,
        table: 'MASA09',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdGame = await createRes.json();
    const gameId = createdGame.id;
    expect(gameId).toBeTruthy();

    const joinRes = await request.post(`${apiRoot}/api/games/${gameId}/join`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: { guestName: guest.credentials.username },
    });
    expect(joinRes.ok()).toBeTruthy();

    const intruderLiveRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(intruder.token, intruder.csrfToken),
      data: {
        liveSubmission: {
          mode: 'Nişancı Düellosu',
          score: 99,
          roundsWon: 99,
          round: 1,
          done: false,
          submissionKey: `arena|${gameId}|intruder|1|99|0`,
        },
      },
    });
    expect(intruderLiveRes.status()).toBe(403);

    const hostLiveRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        liveSubmission: {
          mode: 'Nişancı Düellosu',
          score: 2,
          roundsWon: 2,
          round: 2,
          done: false,
          submissionKey: `arena|${gameId}|${host.credentials.username}|2|2|0`,
        },
      },
    });
    expect(hostLiveRes.ok()).toBeTruthy();

    const guestLiveRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: {
        liveSubmission: {
          mode: 'Nişancı Düellosu',
          score: 1,
          roundsWon: 1,
          round: 2,
          done: false,
          submissionKey: `arena|${gameId}|${guest.credentials.username}|2|1|0`,
        },
      },
    });
    expect(guestLiveRes.ok()).toBeTruthy();

    const hostScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        scoreSubmission: {
          username: host.credentials.username,
          score: 3,
          roundsWon: 3,
          durationMs: 7200,
        },
      },
    });
    expect(hostScoreRes.ok()).toBeTruthy();

    const guestScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: {
        scoreSubmission: {
          username: guest.credentials.username,
          score: 1,
          roundsWon: 1,
          durationMs: 6900,
        },
      },
    });
    expect(guestScoreRes.ok()).toBeTruthy();

    const spoofedFinishRes = await request.post(`${apiRoot}/api/games/${gameId}/finish`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: {
        winner: intruder.credentials.username,
      },
    });
    expect(spoofedFinishRes.ok()).toBeTruthy();
    const spoofedFinishBody = await spoofedFinishRes.json();
    expect(spoofedFinishBody.winner).toBe(host.user.username);

    const gameStateRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(gameStateRes.ok()).toBeTruthy();
    const gameState = await gameStateRes.json();
    expect(gameState.status).toBe('finished');
    expect(gameState.gameState?.resolvedWinner).toBe(host.user.username);
    expect(gameState.winner).toBe(host.user.username);
  });

  test('@advanced resign finalizes aim duel match and blocks additional score writes', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const host = await provisionUser(request, root, 'aimresh');
    const guest = await provisionUser(request, root, 'aimresg');

    await checkInUser(request, root, host.token, { tableNumber: 10, csrfToken: host.csrfToken });
    await checkInUser(request, root, guest.token, { tableNumber: 10, csrfToken: guest.csrfToken });

    const createRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        hostName: host.credentials.username,
        gameType: 'Nişancı Düellosu',
        points: 0,
        table: 'MASA10',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdGame = await createRes.json();
    const gameId = createdGame.id;

    const joinRes = await request.post(`${apiRoot}/api/games/${gameId}/join`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: { guestName: guest.credentials.username },
    });
    expect(joinRes.ok()).toBeTruthy();

    const resignRes = await request.post(`${apiRoot}/api/games/${gameId}/resign`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: {},
    });
    expect(resignRes.ok()).toBeTruthy();
    const resignBody = await resignRes.json();
    expect(resignBody.winner).toBe(host.user.username);

    const guestLateScoreRes = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: {
        scoreSubmission: {
          username: guest.credentials.username,
          score: 9,
          roundsWon: 9,
          durationMs: 1000,
        },
      },
    });
    expect(guestLateScoreRes.status()).toBe(409);

    const stateRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(stateRes.ok()).toBeTruthy();
    const stateBody = await stateRes.json();
    expect(stateBody.status).toBe('finished');
    expect(stateBody.winner).toBe(host.user.username);
    expect(stateBody.gameState?.resolvedWinner).toBe(host.user.username);
  });
});
