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

/**
 * Protocol v2 rollout guard.
 *
 * Until the server-authoritative engine and its client ship together, the two
 * ranked game types are closed and every legacy write path answers 410. These
 * assertions are replaced by the full v2 match flow in the final PR of the
 * series; keeping them here means the intermediate main branch cannot quietly
 * fall back to client-supplied scores.
 */
test.describe('Competitive protocol boundary', () => {
  test('@advanced refuses to open Bilgi Yarışı / Nişancı Düellosu while v2 is disabled', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const host = await provisionUser(request, root, 'v2gate');
    await checkInUser(request, root, host.token, { tableNumber: 9, csrfToken: host.csrfToken });

    for (const gameType of ['Bilgi Yarışı', 'Nişancı Düellosu']) {
      const createRes = await request.post(`${apiRoot}/api/games`, {
        headers: authHeader(host.token, host.csrfToken),
        data: {
          hostName: host.credentials.username,
          gameType,
          points: 0,
          table: 'MASA09',
        },
      });
      expect(createRes.status()).toBe(503);
      const body = await createRes.json();
      expect(body.code).toBe('GAME_ENGINE_MAINTENANCE');
    }
  });

  test('@advanced rejects client-written scores, state and winners on an existing game', async ({
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const host = await provisionUser(request, root, 'v2write');
    const guest = await provisionUser(request, root, 'v2writeg');
    await checkInUser(request, root, host.token, { tableNumber: 11, csrfToken: host.csrfToken });
    await checkInUser(request, root, guest.token, { tableNumber: 11, csrfToken: guest.csrfToken });

    // Chess is outside the gate, so it gives us a real game to attack.
    const createRes = await request.post(`${apiRoot}/api/games`, {
      headers: authHeader(host.token, host.csrfToken),
      data: {
        hostName: host.credentials.username,
        gameType: 'Retro Satranç',
        points: 0,
        table: 'MASA11',
        chessClock: { baseSeconds: 180, incrementSeconds: 2 },
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const gameId = (await createRes.json()).id;

    const joinRes = await request.post(`${apiRoot}/api/games/${gameId}/join`, {
      headers: authHeader(guest.token, guest.csrfToken),
      data: { guestName: guest.credentials.username },
    });
    expect(joinRes.ok()).toBeTruthy();

    for (const payload of [
      { scoreSubmission: { username: host.credentials.username, score: 320, roundsWon: 15 } },
      { liveSubmission: { mode: 'Bilgi Yarışı', score: 320, round: 10, done: true } },
      { gameState: { resolvedWinner: host.credentials.username, settlementApplied: true } },
      { move: 'e2e4' },
    ]) {
      const res = await request.post(`${apiRoot}/api/games/${gameId}/move`, {
        headers: authHeader(host.token, host.csrfToken),
        data: payload,
      });
      expect(res.status()).toBe(410);
      const body = await res.json();
      expect(body.code).toBe('LEGACY_PROTOCOL_DISABLED');
    }

    const finishRes = await request.post(`${apiRoot}/api/games/${gameId}/finish`, {
      headers: authHeader(host.token, host.csrfToken),
      data: { winner: host.credentials.username },
    });
    expect(finishRes.status()).toBe(410);
    expect((await finishRes.json()).code).toBe('LEGACY_PROTOCOL_DISABLED');

    const stateRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: authHeader(host.token),
    });
    expect(stateRes.ok()).toBeTruthy();
    const stateBody = await stateRes.json();
    expect(stateBody.status).toBe('active');
    expect(stateBody.winner).toBeNull();
    expect(stateBody.gameState?.resolvedWinner).toBeUndefined();
    expect(stateBody.gameState?.settlementApplied).toBeUndefined();
  });
});
