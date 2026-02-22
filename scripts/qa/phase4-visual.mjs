import fs from 'fs';
import path from 'path';
import { chromium, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_ROOT = path.resolve(process.cwd(), 'output/playwright/phase4');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_DIR = path.join(OUTPUT_ROOT, stamp);
const STATE_FILE = path.join(OUTPUT_DIR, 'storage-state-cafe-admin.json');
const REPORT_FILE = path.join(OUTPUT_DIR, 'qa-report.txt');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const captured = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const screenshot = async (page, name, fullPage = true) => {
  const file = path.join(OUTPUT_DIR, name);
  await page.screenshot({ path: file, fullPage });
  captured.push(name);
  console.log(`📸 ${name}`);
};

const clickFirstVisible = async (page, locators) => {
  for (const locator of locators) {
    const count = await locator.count();
    if (count === 0) continue;
    const target = locator.first();
    if (!(await target.isVisible().catch(() => false))) continue;
    await target.click();
    return true;
  }
  return false;
};

const acceptCookieIfPresent = async (page) => {
  const candidates = [
    page.getByRole('button', { name: /kabul et/i }),
    page.getByText(/kabul et/i),
  ];
  for (const locator of candidates) {
    const count = await locator.count();
    if (count === 0) continue;
    const target = locator.first();
    const visible = await target.isVisible().catch(() => false);
    if (!visible) continue;
    try {
      await target.click({ timeout: 2000 });
    } catch {
      try {
        await target.click({ force: true, timeout: 2000 });
      } catch {
        // Cookie onayı engellenirse akışı bloklamıyoruz.
      }
    }
    await sleep(300);
    break;
  }
};

const openAuthModal = async (page) => {
  const opened = await clickFirstVisible(page, [
    page.getByRole('button', { name: 'OTURUM AÇ' }),
    page.getByRole('button', { name: /oturum aç/i }),
    page.getByText('OTURUM AÇ'),
  ]);
  if (!opened) {
    throw new Error('Auth modal açma butonu bulunamadı.');
  }
  await page.getByText('GİRİŞ MERKEZİ').waitFor({ timeout: 10000 });
};

const registerUser = async ({ page, username, email, password }) => {
  await page.getByRole('button', { name: 'KAYIT OL' }).first().click();
  await page.getByText('KAYIT MERKEZİ').waitFor({ timeout: 10000 });
  await page.getByPlaceholder('Kullanıcı adı').fill(username);
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-submit-button').click();
};

const loginUser = async ({ page, email, password }) => {
  await page.getByRole('button', { name: 'GİRİŞ YAP' }).first().click();
  await page.getByText('GİRİŞ MERKEZİ').waitFor({ timeout: 10000 });
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-submit-button').click();
};

const logoutIfVisible = async (page) => {
  const count = await page.getByTestId('logout-button').count();
  if (count > 0 && (await page.getByTestId('logout-button').first().isVisible().catch(() => false))) {
    await page.getByTestId('logout-button').first().click();
    await page.waitForURL('**/', { timeout: 15000 }).catch(() => undefined);
    await sleep(600);
  }
};

const ensureAdminLogin = async ({ page, admin }) => {
  await loginUser({ page, email: admin.email, password: admin.password });
  const reachedAdminByLogin = await page.waitForURL('**/admin', { timeout: 7000 }).then(() => true).catch(() => false);
  if (reachedAdminByLogin) return;

  await page.getByRole('button', { name: 'KAYIT OL' }).first().click();
  await page.getByText('KAYIT MERKEZİ').waitFor({ timeout: 10000 });
  await page.getByPlaceholder('Kullanıcı adı').fill(admin.username);
  await page.getByTestId('auth-email-input').fill(admin.email);
  await page.getByTestId('auth-password-input').fill(admin.password);
  await page.getByTestId('auth-submit-button').click();
  await page.waitForURL('**/admin', { timeout: 20000 });
};

const promoteUserToCafeAdmin = async ({ page, username }) => {
  const userRow = page.locator('tr', { hasText: username }).first();
  await userRow.waitFor({ timeout: 15000 });
  await userRow.getByRole('button', { name: 'YÖNETİCİ YAP' }).click();

  await page.getByRole('heading', { name: 'Kafe Yöneticisi Ata' }).waitFor({ timeout: 10000 });
  const cafeSelect = page.locator('label:has-text("Kafe Seç *") + select');
  await cafeSelect.selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Yönetici Yap' }).click();

  await userRow.getByText('CAFE ADMIN').waitFor({ timeout: 15000 });
};

const runDesktopFlow = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 1728, height: 972 },
    geolocation: { latitude: 37.741, longitude: 29.101 },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const nonce = Date.now();
  const regular = {
    username: `phase4u${String(nonce).slice(-6)}`,
    email: `phase4_user_${nonce}@mail.com`,
    password: 'Phase4User123!',
  };
  const admin = {
    username: 'phase4admin',
    email: 'emin3619@gmail.com',
    password: 'Phase4Admin123!',
  };

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await acceptCookieIfPresent(page);
  await screenshot(page, '01-home-desktop.png');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(700);
  await screenshot(page, '02-footer-cookie-desktop.png');

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await openAuthModal(page);
  await screenshot(page, '03-auth-login-desktop.png');

  await page.getByRole('button', { name: 'KAYIT OL' }).first().click();
  await page.getByText('KAYIT MERKEZİ').waitFor({ timeout: 10000 });
  await screenshot(page, '04-auth-register-desktop.png');

  await registerUser({ page, ...regular });
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.getByText('Kafe Giriş').waitFor({ timeout: 15000 });
  await screenshot(page, '05-cafe-selection-desktop.png');

  await page.getByTestId('checkin-table-input').fill('2');
  await page.getByTestId('checkin-submit-button').click();
  await page.getByTestId('user-points').waitFor({ timeout: 20000 });
  await screenshot(page, '06-dashboard-user-desktop.png');

  await page.goto(`${BASE_URL}/store`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Siber Pazar').waitFor({ timeout: 15000 });
  await screenshot(page, '07-store-desktop.png');

  await page.goto(`${BASE_URL}/gizlilik`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /KVKK Aydınlatma Metni/i }).waitFor({ timeout: 15000 });
  await screenshot(page, '08-privacy-desktop.png');

  await page.goto(`${BASE_URL}/reset-password?token=phase4-visual-token`, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Şifreyi Yenile/i).waitFor({ timeout: 15000 });
  await screenshot(page, '09-reset-password-desktop.png');

  await logoutIfVisible(page);
  await openAuthModal(page);
  await ensureAdminLogin({ page, admin });
  await page.getByText('YÖNETİM PANELİ').waitFor({ timeout: 15000 });
  await screenshot(page, '10-admin-dashboard-desktop.png');

  await promoteUserToCafeAdmin({ page, username: regular.username });
  await screenshot(page, '11-admin-after-promote-cafe-admin-desktop.png');

  await logoutIfVisible(page);
  await openAuthModal(page);
  await loginUser({ page, email: regular.email, password: regular.password });
  await page.waitForURL('**/cafe-admin', { timeout: 20000 });
  await page.getByRole('heading', { name: /Kafe Yönetim Paneli/i }).waitFor({ timeout: 15000 });
  await screenshot(page, '12-cafe-admin-verification-desktop.png');

  await page.locator('#cafe-admin-tab-rewards').click();
  await page.getByText('Aktif Ödüller').waitFor({ timeout: 15000 });
  await screenshot(page, '13-cafe-admin-rewards-desktop.png');

  await page.locator('#cafe-admin-tab-settings').click();
  await page.getByText('Konum Doğrulama Ayarları').waitFor({ timeout: 15000 });
  await screenshot(page, '14-cafe-admin-location-desktop.png');

  await context.storageState({ path: STATE_FILE });
  await context.close();
};

const runMobileFlow = async (browser) => {
  const iphone = devices['iPhone 15 Pro'];
  const publicContext = await browser.newContext({
    ...iphone,
    geolocation: { latitude: 37.741, longitude: 29.101 },
    permissions: ['geolocation'],
    ignoreHTTPSErrors: true,
  });
  const publicPage = await publicContext.newPage();

  await publicPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await acceptCookieIfPresent(publicPage);
  await screenshot(publicPage, '15-home-mobile.png');

  await openAuthModal(publicPage);
  await screenshot(publicPage, '16-auth-mobile.png');

  await publicPage.goto(`${BASE_URL}/gizlilik`, { waitUntil: 'domcontentloaded' });
  await publicPage.getByRole('heading', { name: /KVKK Aydınlatma Metni/i }).waitFor({ timeout: 15000 });
  await screenshot(publicPage, '17-privacy-mobile.png');
  await publicContext.close();

  if (fs.existsSync(STATE_FILE)) {
    const cafeContext = await browser.newContext({
      ...iphone,
      geolocation: { latitude: 37.741, longitude: 29.101 },
      permissions: ['geolocation'],
      ignoreHTTPSErrors: true,
      storageState: STATE_FILE,
    });
    const cafePage = await cafeContext.newPage();
    await cafePage.goto(`${BASE_URL}/cafe-admin`, { waitUntil: 'domcontentloaded' });
    await cafePage.getByRole('heading', { name: /Kafe Yönetim Paneli/i }).waitFor({ timeout: 20000 });
    await screenshot(cafePage, '18-cafe-admin-mobile.png');
    await cafeContext.close();
  }
};

const writeReport = () => {
  const reportLines = [
    'CafeDuo Phase 4 Visual QA',
    `Base URL: ${BASE_URL}`,
    `Output Dir: ${OUTPUT_DIR}`,
    '',
    'Captured Screenshots:',
    ...captured.map((name) => `- ${name}`),
    '',
    'Notes:',
    '- Playwright skill wrapper script failed in this environment (missing playwright-cli binary).',
    '- Fallback used: direct Playwright API automation with @playwright/test.',
  ];
  fs.writeFileSync(REPORT_FILE, `${reportLines.join('\n')}\n`, 'utf8');
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktopFlow(browser);
    await runMobileFlow(browser);
    writeReport();
    console.log('\n✅ Phase 4 visual QA completed.');
    console.log(`📁 Artifacts: ${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error('❌ Phase 4 visual QA failed:', error);
  process.exitCode = 1;
});
