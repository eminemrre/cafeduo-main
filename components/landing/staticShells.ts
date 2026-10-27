/**
 * Build-time HTML for the public pages: the head each one ships with and the static first
 * screen inside #root, for crawlers and for the moment before JavaScript loads.
 *
 * vite.config.ts writes dist/index.html, dist/kafeler/index.html and dist/gizlilik/index.html
 * from index.html, replacing what sits between the `<!--page:head-->` and `<!--page:shell-->`
 * markers, and writes the sitemap. The screens are hand-set copies of what React renders
 * first, with the same classes; React replaces them on mount. Only the build imports this file.
 */
import { FOOTER_COLUMNS, OWNER_HERO_FACTS } from './landingContent';
import { whatsappLink } from '../../lib/ownerContact';
import { PUBLIC_PAGES, SITE_URL, pageUrl, type PublicPage, type PublicPath } from './routePages';
import { LEGAL_DOCUMENTS, type LegalPath } from '../../lib/legal/documents';
import {
  LEGAL_LINKS,
  LEGAL_SELLER,
  LEGAL_UPDATED_LABEL,
  LEGAL_VERSION,
} from '../../lib/legal/seller';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const socialLinks = (): string[] =>
  FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href)).filter((href) =>
    href.startsWith('https://')
  );

// The same wrapper App.tsx renders around every route.
const appFrame = (body: string) => `
    <div class="duo-app duo-scope duo-scope-app min-h-screen font-candy-body cdl-static">
      <a href="#main-content" class="skip-link">İçeriğe atla</a>${body}
    </div>
  `;

// The sign-in links open a dialog on the home page; rel="nofollow" keeps crawlers from
// counting /?auth=… as pages of their own.
const playersShell = () =>
  appFrame(`
      <header class="cdl cdl-header">
        <a href="/" class="cdl-wordmark" aria-label="CafeDuo, ana sayfa">CafeDuo</a>
        <nav class="cdl-nav" aria-label="Sayfa bölümleri">
          <a href="/#oyunlar">Oyunlar</a>
          <a href="/#oduller">Ödüller</a>
          <a href="/kafeler">Kafeler için</a>
        </nav>
        <div class="cdl-header-actions">
          <a class="cdl-quiet" href="/?auth=login" rel="nofollow">Giriş yap</a>
          <a class="cdl-button" href="/?auth=register" rel="nofollow">Kaydol</a>
        </div>
      </header>
      <main id="main-content">
        <div class="cdl-page" data-motion="off">
          <div class="cdl">
            <section id="ust" class="cdl-field cdl-hero" aria-labelledby="cdl-hero-title">
              <div class="cdl-tent">
                <div class="cdl-tent-stack">
                  <div class="cdl-tent-card">
                    <i class="cdl-scallop cdl-scallop-tl" aria-hidden="true"></i>
                    <i class="cdl-scallop cdl-scallop-tr" aria-hidden="true"></i>
                    <h1 id="cdl-hero-title">
                      <span class="cdl-tent-line-1">Rakibin</span>
                      <span class="cdl-tent-line-2">yan masada.</span>
                    </h1>
                    <p class="cdl-tent-offer">
                      Aynı kafedeki biriyle satranç, bilgi yarışı, düello ya da amiral battı oyna;
                      kazandığın puanı kafenin ödüllerinde harca.
                    </p>
                    <p class="cdl-tent-meta">
                      <span>İlk 100 puan hediye</span>
                      <i class="cdl-diamond" aria-hidden="true"></i>
                      <span>Her gün çark</span>
                    </p>
                    <div class="cdl-tent-foot">
                      <p class="cdl-tent-scan">Telefonla okut: cafeduotr.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <nav class="cdl-hero-links" aria-label="Sayfa bölümleri">
                <a href="/#oyunlar">Oyunlar</a>
                <a href="/#oduller">Ödüller</a>
                <a href="/kafeler">Kafeler için</a>
              </nav>
            </section>
          </div>
        </div>
      </main>`);

const ownersShell = () =>
  appFrame(`
      <header class="cdl cdl-header">
        <a href="/kafeler" class="cdl-wordmark" aria-label="CafeDuo, sayfanın başı">CafeDuo</a>
        <nav class="cdl-nav" aria-label="Sayfa bölümleri">
          <a href="/kafeler#nasil-calisir">Nasıl işler</a>
          <a href="/kafeler#fiyat">Fiyat</a>
          <a href="/">Oyuncular için</a>
        </nav>
        <div class="cdl-header-actions">
          <a class="cdl-quiet" href="/?auth=login" rel="nofollow">Giriş yap</a>
          <a class="cdl-button" href="${escapeHtml(whatsappLink())}" target="_blank" rel="noopener noreferrer">Pilota başvur</a>
        </div>
      </header>
      <main id="main-content">
        <div class="cdl-page" data-motion="off">
          <div class="cdl">
            <section id="ust" class="cdl-field cdl-hero cdl-owner-hero" aria-label="Kafe sahipleri için ana bölüm">
              <div class="cdl-tent">
                <div class="cdl-tent-stack">
                  <div class="cdl-tent-card cdl-owner-card">
                    <i class="cdl-scallop cdl-scallop-tl" aria-hidden="true"></i>
                    <i class="cdl-scallop cdl-scallop-tr" aria-hidden="true"></i>
                    <h1>
                      <span class="cdl-tent-line-1">Kahve sizden.</span>
                      <span class="cdl-tent-line-2">Oyun bizden.</span>
                    </h1>
                    <p class="cdl-tent-offer">
                      Masalarınızda oyun başlasın; müşterileriniz puan biriktirsin, seçtiğiniz ödüller
                      için yeniden gelsin.
                    </p>
                    <ul class="cdl-owner-facts" aria-label="Anahtar sayılar">${OWNER_HERO_FACTS.map(
                      (fact) => `
                      <li class="cdl-slip-row">
                        <span class="cdl-slip-what">${escapeHtml(fact.what)}</span>
                        <span class="cdl-slip-dots" aria-hidden="true"></span>
                        <span class="cdl-slip-value">${escapeHtml(fact.value)}</span>
                      </li>`
                    ).join('')}
                    </ul>
                    <div class="cdl-owner-card-foot">
                      <a class="cdl-quiet" href="/kafeler#nasil-calisir">Nasıl işler</a>
                      <a class="cdl-quiet" href="/kafeler#fiyat">Fiyat</a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>`);

// Full legal text, not a teaser: the same content remains available without JS.
const legalShell = (path: LegalPath) => {
  const document = LEGAL_DOCUMENTS[path];
  return appFrame(`
    <main id="main-content">
      <article class="duo-scope bg-paper px-5 pb-10 pt-28 text-carbon sm:px-7 sm:pb-16 sm:pt-32">
        <div class="mx-auto max-w-3xl break-words font-candy-body">
          <a class="duo-focus inline-flex min-h-11 items-center underline underline-offset-4" href="/">Ana sayfaya dön</a>
          <header class="mb-10 mt-6">
            <h1 class="font-candy-display text-3xl leading-tight sm:text-5xl">${escapeHtml(document.title)}</h1>
            <p class="mt-4 text-sm text-carbon-muted">Son güncelleme: ${LEGAL_UPDATED_LABEL} · Sürüm: ${LEGAL_VERSION}</p>
            <p class="mt-6 max-w-prose leading-relaxed">${escapeHtml(document.intro)}</p>
          </header>
          <nav aria-label="Bu metinde"><ul class="mb-10 space-y-1 bg-paper-deep p-5">${document.sections
            .map(
              (section) => `
            <li><a class="duo-focus inline-flex min-h-11 items-center underline underline-offset-4" href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`
            )
            .join('')}
          </ul></nav>
          <div class="space-y-10">${document.sections
            .map(
              (section) => `
            <section id="${escapeHtml(section.id)}" class="scroll-mt-28" aria-labelledby="${escapeHtml(section.id)}-title">
              <h2 id="${escapeHtml(section.id)}-title" class="mb-4 font-candy-display text-[1.75rem] leading-tight">${escapeHtml(section.title)}</h2>
              <div class="max-w-prose space-y-4 leading-relaxed">
                ${(section.paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
                ${section.items ? `<ul class="list-disc space-y-3 pl-5">${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
                ${section.links ? `<ul class="space-y-1">${section.links.map((link) => `<li><a class="duo-focus inline-flex min-h-11 items-center underline underline-offset-4" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>` : ''}
              </div>
            </section>`
            )
            .join('')}
          </div>
          <section class="mt-12 bg-paper-deep p-5 sm:p-6" aria-labelledby="legal-contact">
            <h2 id="legal-contact" class="mb-4 font-candy-display text-[1.75rem] leading-tight">İletişim</h2>
            <address class="space-y-3 not-italic leading-relaxed"><p>${escapeHtml(LEGAL_SELLER.name)}</p><p>${escapeHtml(LEGAL_SELLER.address)}</p>
              <a class="duo-focus inline-flex min-h-11 items-center break-all underline underline-offset-4" href="mailto:${escapeHtml(LEGAL_SELLER.email)}">${escapeHtml(LEGAL_SELLER.email)}</a>
            </address>
          </section>
          <nav aria-label="Hukuki metinler"><ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2">${LEGAL_LINKS.map((link) => `<li><a class="duo-focus inline-flex min-h-11 items-center underline underline-offset-4" href="${link.href}">${escapeHtml(link.label)}</a></li>`).join('')}</ul></nav>
        </div>
      </article>
    </main>`);
};

const SHELLS: Record<PublicPath, () => string> = {
  '/': playersShell,
  '/kafeler': ownersShell,
  '/gizlilik': () => legalShell('/gizlilik'),
  '/kosullar': () => legalShell('/kosullar'),
  '/iade': () => legalShell('/iade'),
  '/cerezler': () => legalShell('/cerezler'),
};

const structuredData = (page: PublicPage) => {
  const org = `${SITE_URL}/#organization`;
  const site = `${SITE_URL}/#website`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: 'CafeDuo',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        sameAs: socialLinks(),
      },
      {
        '@type': 'WebSite',
        '@id': site,
        name: 'CafeDuo',
        url: `${SITE_URL}/`,
        inLanguage: 'tr-TR',
        publisher: { '@id': org },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl(page.path)}#webpage`,
        url: pageUrl(page.path),
        name: page.title,
        description: page.description,
        inLanguage: 'tr-TR',
        isPartOf: { '@id': site },
      },
    ],
  };
};

/** Everything in <head> that differs from page to page. */
export const renderPageHead = (page: PublicPage) => {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const url = escapeHtml(pageUrl(page.path));
  // JSON-LD is data, not script: the CSP's script-src does not apply to it. `<` is escaped so
  // no text in it can close the element.
  const jsonLd = JSON.stringify(structuredData(page)).replace(/</g, '\\u003c');
  return `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta name="cafeduo:shell-path" content="${escapeHtml(page.path)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <script type="application/ld+json">${jsonLd}</script>
  `;
};

const replaceBetween = (html: string, marker: string, content: string) => {
  const open = `<!--${marker}-->`;
  const close = `<!--/${marker}-->`;
  const start = html.indexOf(open);
  const end = html.indexOf(close);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`index.html is missing the ${open}…${close} markers`);
  }
  return html.slice(0, start + open.length) + content + html.slice(end);
};

/** index.html with this page's head and first screen. The markers stay, so it can be reused. */
export const renderPageHtml = (html: string, page: PublicPage) =>
  replaceBetween(
    replaceBetween(html, 'page:head', renderPageHead(page)),
    'page:shell',
    SHELLS[page.path]()
  );

export const renderSitemap = (lastmod: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_PAGES.map(
  (page) => `  <url>
    <loc>${pageUrl(page.path)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
).join('\n')}
</urlset>
`;
