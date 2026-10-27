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

test.describe('Realtime chess between two checked-in players', () => {
  test('@advanced host and guest play real moves over the realtime channel', async ({
    browser,
    request,
    baseURL,
  }) => {
    test.setTimeout(180000);
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    // Her iki oyuncu da ayni masada check-in yapmali: lobiler masa koduna gore
    // kapsamlandigi icin farkli masalar birbirinin oyunlarini gormez. Masa 11
    // diger spec'lerde kullanilmadigi icin artik waiting oyun karismaz.
    const hostSession = await provisionUser(request, root, 'chess_host');
    const guestSession = await provisionUser(request, root, 'chess_guest');
    await checkInUser(request, root, hostSession.token, {
      tableNumber: 11,
      csrfToken: hostSession.csrfToken,
    });
    await checkInUser(request, root, guestSession.token, {
      tableNumber: 11,
      csrfToken: guestSession.csrfToken,
    });
    const hostUser = await fetchCurrentUser(request, root, hostSession.token);
    const guestUser = await fetchCurrentUser(request, root, guestSession.token);

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await bootstrapAuthenticatedPage(hostPage, root, hostSession, {
      checkedIn: true,
      userOverride: hostUser,
      skipCheckInRecovery: true,
    });

    // Ev sahibi Retro Satranç oyunu kurar; 10 puanlik stake ile gerçek bir
    // transferlesme (kazanan +10 / kaybeden -10) test edilir.
    await hostPage.getByRole('button', { name: 'Oyun Kur' }).click();
    await hostPage.locator('[data-testid="create-game-modal"]').waitFor({ state: 'visible', timeout: 20000 });
    await hostPage.locator('[data-testid="game-type-chess"]').click();
    await hostPage.locator('[data-testid="game-points-input"]').fill('10');
    await hostPage.locator('[data-testid="create-game-submit"]').click();
    await hostPage.locator('[data-testid="create-game-modal"]').waitFor({ state: 'hidden', timeout: 20000 });

    // Kurulan oyun kendi lobby satirinda "SENİN LOBİN" rozeti ve
    // cancel-game-{id} testid'i ile görünür; oyun id'sini buradan aliyoruz.
    const ownLobbyRow = hostPage.locator('.duo-lobby-row', { hasText: 'SENİN LOBİN' }).first();
    await expect(ownLobbyRow).toBeVisible({ timeout: 20000 });
    const cancelTestId = await hostPage
      .locator('[data-testid^="cancel-game-"]')
      .first()
      .getAttribute('data-testid');
    const gameId = String(cancelTestId || '').replace('cancel-game-', '');
    expect(gameId).not.toBe('');

    await bootstrapAuthenticatedPage(guestPage, root, guestSession, {
      checkedIn: true,
      userOverride: guestUser,
      skipCheckInRecovery: true,
    });

    // Konuk lobide ev sahibinin oyununu görüp gercek JOIN butonuyla katilir.
    const guestRow = guestPage.locator('.duo-lobby-row', { hasText: hostUser.username }).first();
    await expect(guestRow).toBeVisible({ timeout: 20000 });
    await guestRow.getByRole('button', { name: 'Oyuna katıl' }).click();
    await expect(guestPage.locator('[data-testid="retro-chess-board"]')).toBeVisible({ timeout: 30000 });

    // Ev sahibi, konuk katildiktan sonra lobby_updated socket olayiyla (fallback:
    // 15sn poll) aktif oyunu ögrenir ve otomatik katilir; auto-join tetiklenmezse
    // rejoin kartindan "Oyuna dön" ile elle girilir.
    const hostBoard = hostPage.locator('[data-testid="retro-chess-board"]');
    const rejoinButton = hostPage.getByRole('button', { name: 'Oyuna dön' });
    for (let i = 0; i < 60; i += 1) {
      if (await hostBoard.isVisible().catch(() => false)) break;
      if (await rejoinButton.isVisible().catch(() => false)) {
        await rejoinButton.click();
        break;
      }
      await hostPage.waitForTimeout(500);
    }
    await expect(hostBoard).toBeVisible({ timeout: 30000 });

    // Ev sahibi beyazdir (host = white) ve ilk hamle onundur.
    await expect(hostPage.locator('[data-testid="retro-chess-turn-tile"]')).toContainText('Sıra sende', {
      timeout: 20000,
    });

    // e2-e4: REST üzerinden gider, sunucu game_state_updated ile odaya yayinlar.
    const hostE2 = hostPage.locator('[data-testid="retro-chess-square-e2"]');
    await expect(hostE2).toBeEnabled({ timeout: 20000 });
    await hostE2.click();
    await hostPage.locator('[data-testid="retro-chess-square-e4"]').click();

    // Konuk hamleyi socket üzerinden aninda görür: e4'te beyaz piyon ve
    // sira konuga geçmis olmali.
    await expect(
      guestPage.locator('[data-testid="retro-chess-square-e4"]').getByLabel('Beyaz Piyon')
    ).toBeVisible({ timeout: 30000 });
    await expect(guestPage.locator('[data-testid="retro-chess-turn-tile"]')).toContainText('Sıra sende', {
      timeout: 20000,
    });

    // Konuk e7-e5 ile cevap verir; ev sahibi tahtasinda siyah piyonu görür.
    await guestPage.locator('[data-testid="retro-chess-square-e7"]').click();
    await guestPage.locator('[data-testid="retro-chess-square-e5"]').click();
    await expect(
      hostPage.locator('[data-testid="retro-chess-square-e5"]').getByLabel('Siyah Piyon')
    ).toBeVisible({ timeout: 30000 });

    // Ev sahibi teslim olur; sunucu kazanani konuk olarak belirleyip settle
    // eder, iki istemci de sonuc kartini görür.
    await hostPage.getByRole('button', { name: 'Teslim Ol' }).click();
    await expect(hostPage.getByTestId('match-result-card')).toBeVisible({ timeout: 30000 });
    await expect(hostPage.getByTestId('match-result-card')).toContainText(`${guestUser.username} kazandı`);
    await expect(guestPage.getByTestId('match-result-card')).toBeVisible({ timeout: 30000 });
    await expect(guestPage.getByTestId('match-result-card')).toContainText('KAZANDIN');

    // API tarafinda da dogrulanir: oyun bitti, kazanan konuk.
    const gameRes = await request.get(`${apiRoot}/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${hostSession.token}` },
    });
    expect(gameRes.ok()).toBeTruthy();
    const game = await gameRes.json();
    expect(game.status).toBe('finished');
    expect(game.winner).toBe(guestUser.username);

    // Settle dogrulanir: konuk +10 puan ve 1 galibiyet, ev sahibi -10 puan.
    const settledGuest = await fetchCurrentUser(request, root, guestSession.token);
    const settledHost = await fetchCurrentUser(request, root, hostSession.token);
    expect(settledGuest.points).toBe(110);
    expect(settledGuest.wins).toBe(1);
    expect(settledHost.points).toBe(90);
  });
});
