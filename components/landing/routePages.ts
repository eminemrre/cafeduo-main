/**
 * The public pages a search engine can read, with their titles and descriptions.
 *
 * The build writes one HTML file per page from this table (see staticShells.ts); the app reads
 * it to keep the title and description right while the player moves between pages
 * (hooks/usePageMeta).
 */
export const SITE_URL = 'https://cafeduotr.com';

export type PublicPath = '/' | '/kafeler' | '/gizlilik';

export interface PublicPage {
  path: PublicPath;
  title: string;
  description: string;
}

export const pageUrl = (path: string) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`);

export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    path: '/',
    title: 'CafeDuo: Rakibin yan masada',
    description:
      'Aynı kafedeki biriyle satranç, bilgi yarışı, düello ya da amiral battı oyna; kazandığın puanı kafenin ödüllerinde harca. İlk 100 puan hediye.',
  },
  {
    path: '/kafeler',
    title: 'Kafeler için CafeDuo: Kahve sizden, oyun bizden',
    description:
      'Masalarınızda oyun başlasın; müşterileriniz puan biriktirsin, seçtiğiniz ödüller için yeniden gelsin. İlk iki kafeye ilk ay ücretsiz.',
  },
  {
    path: '/gizlilik',
    title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni | CafeDuo',
    description:
      'CafeDuo hangi kişisel verileri hangi amaçla işler, ne kadar saklar; KVKK kapsamındaki haklarınızı nasıl kullanırsınız.',
  },
];

const normalizePath = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

export const findPublicPage = (pathname: string): PublicPage | undefined =>
  PUBLIC_PAGES.find((page) => page.path === normalizePath(pathname));
