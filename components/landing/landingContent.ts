/**
 * Copy for the public landing. Every number follows the real rules in PRODUCT.md; the menu
 * prices are a sample catalogue the cafés replace with their own (see the note on the page).
 */

export const toyImage = (name: string) => `/landing/toys/${name}.webp`;

/** The three games, in the order they stack on the page. */
export const GAMES = [
  {
    id: 'satranc',
    name: 'Retro Satranç',
    text: 'Gerçek zamanlı, sunucuda doğrulanan hamleler. 3+2 ya da 5+0 tempoda oynanır; süre biterse bayrak düşer.',
    toy: 'knight',
    toyAlt: 'Gök mavisi oyuncak satranç atı, tahtanın üzerinde',
  },
  {
    id: 'bilgi',
    name: 'Bilgi Yarışı',
    text: 'On kısa soru, iki oyuncu. Aynı soruyu daha hızlı ve doğru cevaplayan turu alır.',
    toy: 'quiz',
    toyAlt: 'Limon sarısı oyuncak soru kartı, üzerinde soru işareti',
  },
  {
    id: 'nisanci',
    name: 'Nişancı Düellosu',
    text: 'Beş tur boyunca nişangahı merkeze kilitle; isabet toplayan maçı alır. Her tur sunucuda sayılır.',
    toy: 'target',
    toyAlt: 'Pembe beyaz oyuncak hedef tahtası ve üzerine saplanmış dart',
  },
] as const;

/** The order slip: what happens, in order, with the real numbers and the time each step takes. */
export const SLIP = [
  {
    label: 'Kafede',
    rows: [
      { what: 'Masadaki kodu gir ya da 150\u00A0m içinde konumdan onayla', value: '10 sn' },
      { what: 'Masan açılır, lobiyi görürsün', value: 'anında' },
    ],
  },
  {
    label: 'Masada',
    rows: [
      { what: 'Açık bir oyuna otur; puanı baştan görürsün', value: '1 dk' },
      { what: 'Satranç, bilgi yarışı ya da düello oyna', value: '3–5 dk' },
    ],
  },
  {
    label: 'Kazanınca',
    rows: [
      { what: 'Kazanan, rakibinin koyduğu kadar puan alır', value: 'anında' },
      { what: 'Kuponu kasada okut', value: 'kasada' },
    ],
  },
] as const;

export const SLIP_RESULT = { what: 'Bittiğinde puan ve kupon hesabında', value: '≈15 dk' };

/** The live table's tabs: what the toy set on the table stands for. */
export const SHOWCASE_TABS = [
  {
    id: 'oyun',
    label: 'Oyun',
    title: 'Üç oyun, tek masa',
    text: 'Satranç, bilgi yarışı ve düello gerçek zamanlı: her hamle sunucuda doğrulanır, ikiniz de aynı anda görürsünüz.',
  },
  {
    id: 'puan',
    label: 'Puan',
    title: 'Kazanan bahsi alır',
    text: 'İki taraf da oyuna baştan puan koyar; kazanan, rakibinin koyduğu kadarını alır. En fazla 100 puan.',
  },
  {
    id: 'odul',
    label: 'Ödül',
    title: 'Kasada okutulur',
    text: 'Puanlar kafenin menüsünde harcanır; kupon panelinde çıkar, kasiyer QR kodunu okutur.',
  },
] as const;

/** The reward menu: sample prices, one row per shelf, the first shelf open. */
export const MENU = [
  {
    label: 'Sıcak',
    items: [
      { name: 'Filtre kahve', cost: 500 },
      { name: 'Latte', cost: 650 },
      { name: 'Çay', cost: 250 },
    ],
  },
  {
    label: 'Soğuk',
    items: [
      { name: 'Limonata', cost: 300 },
      { name: 'Buzlu latte', cost: 700 },
    ],
  },
  {
    label: 'Tatlılar',
    items: [
      { name: 'Cheesecake', cost: 400 },
      { name: 'Brownie', cost: 450 },
      { name: 'Kurabiye', cost: 120 },
    ],
  },
  {
    label: 'Atıştırmalık',
    items: [
      { name: 'Simit', cost: 150 },
      { name: 'Kaşarlı tost', cost: 300 },
    ],
  },
  {
    label: 'Oyun',
    items: [
      { name: 'Jeton x5', cost: 100 },
      { name: 'Jeton x10', cost: 180 },
    ],
  },
] as const;

export const FOOTER_COLUMNS = [
  {
    label: 'Sayfa',
    links: [
      { label: 'Oyunlar', href: '/#oyunlar' },
      { label: 'Ödüller', href: '/#oduller' },
      { label: 'Nasıl işler', href: '/#nasil' },
    ],
  },
  {
    label: 'Kafeler',
    links: [
      { label: 'Kafeler için', href: '/kafeler' },
      { label: 'Gizlilik', href: '/gizlilik' },
    ],
  },
  {
    label: 'Takip',
    links: [
      { label: 'Instagram', href: 'https://instagram.com/cafeduotr' },
      { label: 'X (Twitter)', href: 'https://x.com/cafeduotr' },
    ],
  },
] as const;

export const FOOTER_CONTACT = ['cafeduotr@gmail.com', 'cafeduotr.com'] as const;
