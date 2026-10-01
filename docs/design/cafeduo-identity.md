# CafeDuo arayüz dili

CafeDuo’nun ana sayfası bir kafe oyun kulübü gibi davranır: oyun tahtası, kısa katılım açıklaması ve oyun listesi. Krem/pembe/mavi/hardal renk kimliği korunur. Büyük reklam sloganları, dekoratif afişler, yüzen parçacıklar ve tekrarlanan ikonlu kartlar kullanılmaz.

## Ana sayfa

- Krem kâğıt zemin (`#fbf7ee`), koyu mürekkep (`#242824`), pembe vurgu (`#be3469`). Tahtada toz mavi (`#91a7c6`) ve krem (`#eee7d6`); hardal küçük bir kulüp notunda kullanılır.
- Fraunces başlıklar ve gerçek italik, Familjen Grotesk gövde metni. JetBrains Mono yalnız satranç notasyonu ve kısa oyun numaralarında kullanılır. Yazı tipleri Türkçe karakterlerle birlikte yerel sunulur.
- Başlangıç cümlesi gündeliktir: “Bir el oynayalım mı?” Eylemler “Masaya katıl” ve “Zaten üyeyim”. Hayalî canlı oyuncu sayısı, ödül miktarı veya puan gösterilmez.
- Ana sayfada gerçekten hamle yapılabilen 8×8 satranç tahtası bulunur. Beyazı ziyaretçi oynar, siyah kurallara uygun otomatik yanıt verir. Deneme hesabı, sunucu maçı veya kazanılmış puan oluşturmaz; bu bilgi tahtanın altında görünür.
- Satranç motoru ilk etkileşimde dinamik yüklenir. Taş seçimi, geçerli hedef işaretleri, hamle notasyonu ve baştan başlatma gerçek tahta durumuna bağlıdır.
- Tahta klavyede tek Tab durağıdır; ok tuşları kareler arasında dolaşır, Enter/Space seçim yapar. Motor yüklenirken odak kaybolmaz. Hamleler erişilebilir canlı durum metniyle bildirilir.
- Katılım akışı numaralı, çizgilerle ayrılmış bir listedir. Oyunlar başlık, kısa açıklama ve katılım eylemi içeren satırlardır. Adlar mevcut oyunlarla eşleşir: Retro Satranç, Bilgi Yarışı, Nişancı Düellosu.
- Telefonlarda metin, eylemler ve tahta tek sütuna geçer. Gereksiz dekorasyon veya kaydırma animasyonu yoktur. `prefers-reduced-motion` eylem geçişlerini durdurur.

## Ortak kontroller ve oyuncu paneli

- `styles/identity.css` ortak Button/Input/Card, giriş diyaloğu ve oyuncu paneli stillerini içerir. Panelde Unbounded başlıklar ve mevcut okunaklı kontrol stilleri korunur.
- Ana eylemler en az 44 px, form alanları en az 48 px. Telefonlarda form metni 16 px; etiketler kalıcıdır ve autocomplete uygundur.
- Giriş diyaloğu Esc ile kapanır, odağı içeride tutar ve kapandığında açan kontrole geri verir. Ayrı çerez bildirimi klavye ile erişilebilir kalır. Başlangıç odağı mobil klavyeyi gereksiz açmaz.
- Panel sekmelerinin adı dar ekranlarda görünür. Seçim `aria-pressed` ile bildirilir. Lobi kartları üst üste binmez; boş durum oyunu nasıl başlatacağını anlatır.

## Stil sınırı ve kapsam

`styles/club.css`, `styles/identity.css` sonrasında yüklenir. Ana sayfa `club-*` sınıflarıyla sınırlandırılır; eski ana sayfa stilleri ortak kimlik dosyasından kaldırılır. Global element kurallarına yeni neon stiller eklenmez. Eski `rf-*`/`cd-*` bileşenleri kendi kapsamlarında kalır.

Bu revizyon ana sayfa, gezinme, giriş-kayıt, check-in yerleşimi, oyuncu paneli durum alanı/sekmesi ve ortak kontrollere odaklanır. Sunucu oyun kuralları, ekonomi, veri modeli ve canlı kullanıcı verileri değişmez. İşletme/yönetim ekranlarının tüm bilgi mimarisi ve oyun içi ekranlar baştan tasarlanmamıştır.
