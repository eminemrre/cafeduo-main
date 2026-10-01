# CafeDuo arayüz dili

Bu kılavuz ana sayfa, oyuncu paneli ve ortak arayüz bileşenlerinin güncel görsel dilini tanımlar. Uygulamanın cream/pink/blue/mustard renk kimliği korunur. `styles/identity.css`, `index.css` sonrasında yüklenir; yeni bileşenler `duo-*` sınıflarıyla sınırlanır.

## Görsel hiyerarşi

- Krem zemin ve koyu mürekkep metin; mavi ve pembe ana eylemler, hardal küçük oyun vurguları.
- Unbounded başlıklar, Familjen Grotesk gövde metni, JetBrains Mono kısa etiketler. Yazı tipleri yerel sunulur.
- 10–18 px yuvarlatılmış kontroller/kartlar, ince kenarlar. Sert baskı gölgesi ana eylem ve oyun afişinde; bilgi kartlarında hafif gölge.
- Dekorasyon ana sayfadaki oyun sahnesinde toplanır. Giriş ve panelde bilgi/eylem önceliklidir. Sahne bir önizlemedir; gerçek oyuncu, canlı skor veya kazanılmış ödül iddiası içermez.
- Kullanıcıya teknik jargon, sürüm etiketi veya temsili canlı istatistik gösterilmez. Mevcut sürüm bilgisi destek için alt bilgide tutulur.

## Etkileşim

- Ana eylemler en az 44 px, form alanları en az 48 px. Telefonlarda form metni 16 px.
- Formlarda kalıcı etiket ve uygun autocomplete. Hata mesajları alert olarak duyurulur.
- Giriş diyaloğu Esc ile kapanır, odağı içeride tutar ve kapandığında açan kontrole geri verir. Ayrı çerez bildirimi klavye ile erişilebilir kalır. Mobil klavyeyi gereksiz açmamak için başlangıç odağı diyalogdadır.
- Dar ekranlarda panel sekmelerinin adı görünür. Seçili düğme aria-pressed ile bildirilir; sekmeler klavyede normal düğmeler gibi çalışır.
- Lobi kartları üst üste binmez; boş durum oyunu nasıl başlatacağını anlatır. Oyun kurma/eşleşme yetkileri ve sunucu davranışı değişmez.
- Ana sayfadaki hareket dekoratiftir; reduced-motion tercihi hover hareketlerini durdurur. Mevcut FloatingSquareField/Reveal bileşenleri kendi azaltılmış hareket davranışını korur.

## Stil sınırı

Global `button`, `input`, `select`, `body` kurallarına legacy neon stiller eklenmez. Eski `rf-*`/`cd-*` bileşen stilleri yalnız kendi kapsamlarında kalır. Kullanıcı akışlarında aynı ortak Button/Input/Card bileşenleri tercih edilir.

## Bu revizyonun kapsamı

Ana sayfa/akış/oyun tanıtımı, navbar, giriş-kayıt, check-in yerleşimi, oyuncu durum alanı ve sekmeleri, lobi/ödül kartları, ortak oyuncu ve yönetim kontrol stilleri. Oyun mekanikleri, ekonomi, veri modeli ve canlı kullanıcı verileri değiştirilmez. Oyun içi ekranlar ve işletme/yönetim ekranlarının tüm bilgi mimarisi bu revizyonda baştan tasarlanmamıştır.
