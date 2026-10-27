/**
 * The public pages a search engine can read, with their titles and descriptions.
 *
 * The build writes one HTML file per page from this table (see staticShells.ts); the app reads
 * it to keep the title and description right while the player moves between pages
 * (hooks/usePageMeta).
 */
export const SITE_URL = 'https://cafeduotr.com';

export type PublicPath = '/' | '/kafeler' | '/gizlilik' | '/kosullar' | '/iade' | '/cerezler';

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
  {
    path: '/kosullar',
    title: 'Kullanım Koşulları | CafeDuo',
    description:
      'CafeDuo üyeliği, oyunlar, puanlar, kafe ödülleri ve planlanan abonelik hizmetinin kullanım koşulları ve iletişim bilgileri.',
  },
  {
    path: '/iade',
    title: 'İade ve İptal Politikası | CafeDuo',
    description:
      'CafeDuo kafe aboneliği için iptal, iade talebi, Paddle’ın rolü ve kanuni haklara ilişkin açıklamalar.',
  },
  {
    path: '/cerezler',
    title: 'Çerez Politikası | CafeDuo',
    description:
      'CafeDuo zorunlu oturum ve güvenlik çerezleri, yerel depolama amaçları, süreleri ve tarayıcı kontrol seçenekleri.',
  },
];

const normalizePath = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

export const findPublicPage = (pathname: string): PublicPage | undefined =>
  PUBLIC_PAGES.find((page) => page.path === normalizePath(pathname));
