# CafeDuo arayüz dili

CafeDuo’nun ana sayfası bir kafe oyun kulübü gibi davranır: oyun tahtası, kısa katılım açıklaması ve oyun listesi. Krem/pembe/mavi/hardal renk kimliği korunur. Büyük reklam sloganları, dekoratif afişler, yüzen parçacıklar ve tekrarlanan ikonlu kartlar kullanılmaz.

## Ana sayfa

Yön: taste-skill "The product performs" (`landing-direction-sheet.md`), referans The Tie-break (`reference-tiebreak.md`). Kod `components/landing/`, stil `styles/landing.css` (`.cdl` kapsamı).

- Fikir: kafe masası ve kodu (MASA07), çalışan bir satranç parçasında rakip olur; MASA07'nin her yanıtı bir İzmir semtinin fotoğrafını bulanıktan nete getirir.
- Beyaz zemin, `#111` mürekkep, `#6b6b6b` ikincil metin, `#f4f4f4` yüzey, tek vurgu mavi `#1a4be0` (bağlantılar ve tek düğme). Ürün parçalarının (`data-ui`) içinde ürünün kendi renkleri kalır: tahtada krem `#eee7d6` ve toz mavi `#91a7c6`, seçimde pembe `#be3469`.
- Tek yazı tipi Albert Sans (400/500/600, yerel `@fontsource`), beş boyut adımı, tek köşe yarıçapı (4 px).
- Başlık her genişlikte yapışkan: "Giriş yap" ve "Masaya katıl" hep erişilebilir. Başlık ve alt satır `<main>` dışında, App'te Navbar/Footer yerine çizilir.
- Bölümler: kesik köşeli sahnede MASA07 tahtası → "Masadan ödüle" (masaüstünde sabit panel üç durumu değiştirir; telefonda her adımın altında kendi durumu) → karanlık şeritte oyun ve ödül parçaları → semt listesi ve görsel kredileri → aksiyon karoları → tek satırlık alt bilgi.
- Rakamlar gerçek kurallardan gelir: yeni üye 100 puan, 20 puanlık maç +20, Oyun Jetonu x5 100 puan, çark 15/50/250/Bedava Kahve.
- Fotoğraflar Wikimedia Commons'tan (kaynak ve lisans `components/landing/landingContent.ts` ve `public/landing/credits.json`); sayfada kredilendirilir ve hiçbiri ortak kafe olarak gösterilmez. Semt listesi kafe değil semt gösterir.
- WebGL kullanılmaz. Hareket `LandingExperience` ile açılıp kapanır; azaltılmış harekette fotoğraf doğrudan nettir. Tahta tek Tab durağı, ok tuşlarıyla gezilir.

## Ortak kontroller ve oyuncu paneli

- `styles/identity.css` ortak Button/Input/Card, giriş diyaloğu ve oyuncu paneli stillerini içerir. Panelde Unbounded başlıklar ve mevcut okunaklı kontrol stilleri korunur.
- Ana eylemler en az 44 px, form alanları en az 48 px. Telefonlarda form metni 16 px; etiketler kalıcıdır ve autocomplete uygundur.
- Giriş diyaloğu Esc ile kapanır, odağı içeride tutar ve kapandığında açan kontrole geri verir. Ayrı çerez bildirimi klavye ile erişilebilir kalır. Başlangıç odağı mobil klavyeyi gereksiz açmaz.
- Panel sekmelerinin adı dar ekranlarda görünür. Seçim `aria-pressed` ile bildirilir. Lobi kartları üst üste binmez; boş durum oyunu nasıl başlatacağını anlatır.

## Stil sınırı ve kapsam

`styles/club.css`, `styles/identity.css` sonrasında yüklenir ve `/kafeler` sayfasıyla `LandingExperience` hareket kurallarını taşır. Ana sayfa `styles/landing.css` içinde `.cdl` kapsamındadır. Global element kurallarına yeni neon stiller eklenmez. Eski `rf-*`/`cd-*` bileşenleri kendi kapsamlarında kalır.

Bu revizyon ana sayfa, gezinme, giriş-kayıt, check-in yerleşimi, oyuncu paneli durum alanı/sekmesi ve ortak kontrollere odaklanır. Sunucu oyun kuralları, ekonomi, veri modeli ve canlı kullanıcı verileri değişmez. İşletme/yönetim ekranlarının tüm bilgi mimarisi ve oyun içi ekranlar baştan tasarlanmamıştır.
