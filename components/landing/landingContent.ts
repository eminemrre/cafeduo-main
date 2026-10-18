/** Copy for the public landing. Numbers follow the real rules in PRODUCT.md. */

export const toyImage = (name: string) => `/landing/toys/${name}.webp`;

export const GAMES = [
  {
    id: 'satranc',
    name: 'Retro Satranç',
    text: 'Gerçek zamanlı; her hamle sunucuda doğrulanır.',
    meta: '3+2 ya da 5+0 tempo',
    toy: 'knight',
    toyAlt: 'Gök mavisi oyuncak satranç atı',
    tilt: -3,
  },
  {
    id: 'bilgi',
    name: 'Bilgi Yarışı',
    text: 'Aynı sorular, iki oyuncu. Doğru cevabı en hızlı veren turu alır.',
    meta: '10 kısa soru',
    toy: 'quiz',
    toyAlt: 'Limon sarısı oyuncak soru kartı',
    tilt: 2,
  },
  {
    id: 'nisanci',
    name: 'Nişancı Düellosu',
    text: 'Nişangahı merkeze kilitle, tur tur isabet topla.',
    meta: '5 tur',
    toy: 'target',
    toyAlt: 'Pembe beyaz oyuncak hedef tahtası ve dart',
    tilt: -1.5,
  },
] as const;

export const REWARDS = [
  { name: 'Oyun Jetonu x5', cost: 100 },
  { name: 'Cheesecake İkramı', cost: 400 },
  { name: 'Bedava Filtre Kahve', cost: 500 },
] as const;

export const STEPS = [
  {
    title: 'Kafede check-in yap',
    text: 'Kafenin 150 metre içindeysen ya da masandaki kodu girersen masan açılır.',
    toy: 'tent',
    toyAlt: 'Üzerinde MASA07 yazan oyuncak masa tabelası',
  },
  {
    title: 'Açık bir masayla eşleş',
    text: 'Lobide aynı kafedeki oyunları görürsün. Rakibin ne kadar puan koyduysa en fazla o kadar kazanırsın.',
    toy: 'knight',
    toyAlt: '',
  },
  {
    title: 'Kazan, kasada okut',
    text: 'Puanını kafenin ödüllerine çevir; kuponunu kasada okuturlar.',
    toy: 'coin',
    toyAlt: '',
  },
] as const;
