# Hareket sistemi (motion)

CafeDuo'nun animasyon dili tek bir yerden yönetilir: `lib/motion.ts` (JS) ve
`index.css` içindeki `--ease-*` / `--dur-*` değişkenleri (CSS). İkisi arasındaki
uyum `lib/motion.test.ts` ile denetlenir; yeni bir süre veya eğri eklerken her iki
dosyayı birlikte güncelleyin.

## Token'lar

| Token            | Değer                          | Nerede                         |
| ---------------- | ------------------------------ | ------------------------------ |
| `EASE.brand`     | `cubic-bezier(.35, 0, 0, 1)`   | Girişler, panel ve menüler     |
| `EASE.outQuart`  | `cubic-bezier(.25, 1, .5, 1)`  | Çıkışlar, hover geri bildirimi |
| `EASE.inOutExpo` | `cubic-bezier(.87, 0, .13, 1)` | Tam ekran geçişler             |
| `DURATION.fast`  | 150 ms                         | Hover / basma feedback         |
| `DURATION.base`  | 300 ms                         | Varsayılan durum değişimleri   |
| `DURATION.slow`  | 500 ms                         | Ağır girişler                  |
| `STAGGER`        | 20 ms                          | Sıralı liste gecikmeleri       |

`EASE.brand` "hızlı başla, uzun otur" eğrisidir; hareketin pahalı hissettiren
kısmı budur. Bir bileşene özel süre uydurmak yerine bu ölçekten seçin.

## Kullanılan desenler

- **Mobil menü** (`components/Navbar.tsx`): satırlar 20 ms arayla yukarıdan aşağı
  girer, kapanışta `staggerDirection: -1` ile ters sırayla çıkar. Perde tıklaması
  ve `Escape` paneli kapatır.
- **Link alt çizgisi** (`components/ui/HoverUnderline.tsx`): hover'da soldan
  çizilir, bırakınca geri çekilir; hafif kavisli olduğu için CSS kenarlığı gibi
  değil basılı mürekkep gibi okunur.
- **Decode metin** (`components/ui/DecodeText.tsx`): saniyede 40 karakter çözülür,
  çözülen kısmın peşinde en fazla 5 rastgele karakterlik bir gürültü kuyruğu
  ilerler; ekran saniyede 15 kez tazelenir. Yükleme ve bekleme etiketlerinde
  kullanılır. Matematik `lib/decodeText.ts` içinde saf fonksiyondur.
- **Sayfa çerçevesi** (`App.tsx` PageFrame): rota içeriği beklemeden basılır;
  çıkış animasyonu bilinçli olarak yok (yukarı akışın kararı), bu yüzden gezinme
  gecikme hissi vermez. Rota perdesi fikri planın kalan yüzeyleri arasında durur.

## Değerlerin kaynağı

Süre/eğri ve kademe değerleri, ödül alan sitelerin tarayıcıya giden kodunun pasif
incelemesinden (REA ile, plan adım 17) çıkarıldı; ilk referans lusion.co (2023 Site
of the Year). Yalnızca parametreler ve koreografi uyarlanır — kaynak kod kopyalanmaz.

## Kurallar

- `prefers-reduced-motion` her katmanda korunur: `index.css`'teki global kapatma
  animasyonları sıfırlar, JS tarafında `Reveal`, `DecodeText` ve `HoverUnderline`
  `useReducedMotion()` ile hareketi kaldırır.
- Süsleme amaçlı animasyon (alt çizgi, gürültü kuyruğu) `aria-hidden` olur; gerçek
  metin erişilebilirlik ağacında kalır (`DecodeText` metni `aria-label` taşır).
- Yeni bir CSS animasyonu süre/eğri değerlerini sabit yazmaz; `var(--dur-base)` ve
  `var(--ease-brand)` kullanır.
