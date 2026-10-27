/** Change the version only when publishing a reviewed revision of these documents. */
export const LEGAL_VERSION = '2026-10-27';
export const LEGAL_UPDATED_LABEL = '27 Ekim 2026';

export const LEGAL_SELLER = {
  name: 'Emin Emre',
  email: 'cafeduotr@gmail.com',
  address: 'Yeniköy Mahallesi Gaziler Caddesi No:40, Torbalı / İzmir',
} as const;

export const LEGAL_LINKS = [
  { href: '/kosullar', label: 'Kullanım koşulları' },
  { href: '/iade', label: 'İade ve iptal' },
  { href: '/gizlilik', label: 'Gizlilik ve KVKK' },
  { href: '/cerezler', label: 'Çerez politikası' },
] as const;
