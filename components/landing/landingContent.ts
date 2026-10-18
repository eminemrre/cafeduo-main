/**
 * Content of the public landing (/). Photographs are open-licence pictures of İzmir districts
 * from Wikimedia Commons; they show the city around the cafés, never a partner café.
 */

export interface LandingPhoto {
  id: string;
  district: string;
  alt: string;
  creator: string;
  licence: string;
  source: string;
  width: number;
  height: number;
}

const photo = (
  id: string,
  district: string,
  alt: string,
  creator: string,
  licence: string,
  source: string,
  height = 1200
): LandingPhoto => ({ id, district, alt, creator, licence, source, width: 1600, height });

export const PHOTOS = {
  kordon: photo(
    'kordon-tramvay',
    'Kordon, Alsancak',
    'Alsancak Kordon’da gün batımı, kıyı boyunca giden tramvay',
    'Egemen Bilek',
    'CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:CordonAlsancak2.jpg'
  ),
  karsiyaka: photo(
    'karsiyaka-iskele',
    'Karşıyaka',
    'Karşıyaka İskelesi önünde bekleyen vapurlar ve kıyıdaki binalar',
    '1508857',
    'CC0',
    'https://commons.wikimedia.org/wiki/File:Kar%C5%9F%C4%B1yaka_Ferry_Terminal,_October_2015.jpg'
  ),
  bostanli: photo(
    'bostanli-aksam',
    'Bostanlı',
    'Bostanlı sahilinden gün batımından sonra Mavişehir ışıkları',
    'ilker arslantürk',
    'CC BY 3.0',
    'https://commons.wikimedia.org/w/index.php?curid=59700021'
  ),
  konak: photo(
    'konak-saat-kulesi',
    'Konak',
    'Konak Meydanı’nda Saat Kulesi ve palmiyeler',
    'Francisco Anzola',
    'CC BY 2.0',
    'https://commons.wikimedia.org/w/index.php?curid=79403458',
    1197
  ),
  urla: photo(
    'urla-iskele',
    'Urla',
    'Urla iskelesinde bağlı balıkçı tekneleri',
    'Raicem',
    'CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:%C4%B0zmir_Urla_%C4%B0skele.jpg'
  ),
  goztepe: photo(
    'goztepe-tramvay',
    'Göztepe',
    'Göztepe’de sahil bulvarı boyunca tramvay durağı',
    'Btian Paul Dorsam',
    'CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:G%C3%B6ztepe_tram.jpg',
    900
  ),
  kordonWalk: photo(
    'kordon-yuruyus',
    'Kordon',
    'Kordon’da çiçekli yürüyüş yolu ve deniz kıyısındaki çimenler',
    'raicem',
    'CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:%C4%B0zmir_Kordon.jpg'
  ),
} satisfies Record<string, LandingPhoto>;

export const BAY_VIDEO = {
  src: '/landing/asansor-korfez.webm',
  poster: '/landing/asansor-korfez-poster.webp',
  title: 'Tarihi Asansör’den İzmir Körfezi',
  creator: 'Gcinar1',
  licence: 'CC BY-SA 4.0',
  source:
    'https://commons.wikimedia.org/wiki/File:%C4%B0zmir_Tarihi_Asans%C3%B6r_Manzaras%C4%B1.webm',
};

export const photoSrc = (item: LandingPhoto, size: 64 | 720 | 1600) =>
  `/landing/${item.id}-${size}.webp`;

/** Each MASA07 reply on the hero board brings the next district into focus. */
export const HERO_DISTRICTS: LandingPhoto[] = [
  PHOTOS.kordon,
  PHOTOS.karsiyaka,
  PHOTOS.bostanli,
  PHOTOS.konak,
  PHOTOS.urla,
  PHOTOS.goztepe,
];

export interface DistrictRow {
  name: string;
  place: string;
  photo?: LandingPhoto;
  dot?: string;
}

export const DISTRICT_GROUPS: Array<{ title: string; rows: DistrictRow[] }> = [
  {
    title: 'Merkez',
    rows: [
      { name: 'Alsancak', place: 'Kıbrıs Şehitleri Caddesi', photo: PHOTOS.kordon },
      { name: 'Kordon', place: 'Atatürk Caddesi, deniz kıyısı', photo: PHOTOS.kordonWalk },
      { name: 'Konak', place: 'Saat Kulesi', photo: PHOTOS.konak },
      { name: 'Göztepe', place: 'Mustafa Kemal Sahil Bulvarı', photo: PHOTOS.goztepe },
    ],
  },
  {
    title: 'Karşı yaka',
    rows: [
      { name: 'Karşıyaka', place: 'Karşıyaka İskelesi', photo: PHOTOS.karsiyaka },
      { name: 'Bostanlı', place: 'Bostanlı İskelesi', photo: PHOTOS.bostanli },
      { name: 'Mavişehir', place: 'Mavişehir sahili', dot: '#1a4be0' },
      { name: 'Çiğli', place: 'İzmir Kâtip Çelebi Üniversitesi', dot: '#111111' },
    ],
  },
  {
    title: 'Kampüsler',
    rows: [
      { name: 'Bornova', place: 'Ege Üniversitesi', dot: '#91a7c6' },
      { name: 'Buca', place: 'DEÜ Tınaztepe Kampüsü', dot: '#be3469' },
      { name: 'Balçova', place: 'İzmir Ekonomi Üniversitesi', dot: '#6b6b6b' },
      { name: 'Urla', place: 'İYTE Gülbahçe Kampüsü', photo: PHOTOS.urla },
    ],
  },
];

export const CREDITS: Array<{
  label: string;
  creator: string;
  licence: string;
  source: string;
  thumb?: string;
}> = [
  ...Object.values(PHOTOS).map((item) => ({
    label: item.district,
    creator: item.creator,
    licence: item.licence,
    source: item.source,
    thumb: photoSrc(item, 64),
  })),
  {
    label: BAY_VIDEO.title,
    creator: BAY_VIDEO.creator,
    licence: BAY_VIDEO.licence,
    source: BAY_VIDEO.source,
  },
];
