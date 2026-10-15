# CafeDuo otomasyon raporu — 2 Ekim 2026, profil verilerinin doğruluğu

## Başlangıç ve audit

Başlangıç commit'i `42cff200b3894338bf5157f67ecccd07e31dfbff`; güncel `work/release` temiz ve origin/main ile 0/0 farkta. Son commitler ile parola kurtarma, masa kodu ve oyuncu pencereleri raporları okundu. Önceki turdaki canlı `a2fb820` ve `outputs/2026-10-02-player-dialogs-release.md` sonuçları referans alındı. Eski snapshot ve ana repository'nin kaydedilmemiş dosyalarına dokunulmadı. Yeni dal: `fix/profile-data-2026-10-02`.

Product/UX, görsel tasarım, frontend mimarisi, performans, erişilebilirlik ve QA aynı profil yolculuğunda değerlendirildi. Önceki klavye, Escape, iç scroll, responsive ve hata sonrası kayıt düzeltmeleri yeniden tasarlanmadı.

## Önemli problemler

- “Son Aktivite” her kullanıcı için aynı üç kurgu maç, puan kazancı/kaybı ve göreli zamanı gösteriyordu; oyun oynamamış kullanıcıda bile zaferler vardı.
- Profil veri ve bölüm hata metni ink rengine alındı; kırmızı hata vurgusu kenarlıkta tutuldu. Yeni küçük hata metinlerinde redox/kağıt yaklaşık 4.08:1, ink/kağıt yaklaşık 17:1 kontrast verdi.
- Rakip profili yalnız kullanıcı adıyla açılmasına rağmen ID=0, puan=0, oyun=0 ve LEVEL 1 gerçek bilgi gibi gösteriliyordu.
- Envanter endpoint'i oturum sahibinin verisini döndürürken bu veri rakip profiline de yerleştiriliyordu. Geciken yanıtlar profil değişiminden sonra eski veri yazabiliyordu.
- Envanter hataları yalnız konsola yazılıyor, bölüm ya kayboluyor ya eski içerik gösteriyordu. Geçmiş API helper'ı sunucu hatasını boş listeye çeviriyordu; gerçek boşluk ile hata ayırt edilemiyordu.

## Seçilen görevler ve öncelik gerekçesi

Profilin güvenilir bilgi göstermesi ve veriyi doğru kişiye ait tutması, yeni süs veya animasyondan daha yüksek ürün değeri taşıyor. Kendi profilinde gerçek geçmiş/envanter ve açık durumlar; rakipte yalnız paylaşılabilen kullanıcı adı ile açıklama; async veri izolasyonu birlikte uygulandı. Başka oyuncunun özel geçmişini istemek için backend yetkileri genişletilmedi.

## UI/UX iyileştirmeleri

- Kendi profilindeki “Son oyunların” mevcut API'nin son üç tamamlanmış maçını, gerçek rakibi ve kayıt tarihini gösterir. Galibiyet, mağlubiyet ve beraberlik ayrı metinle ifade edilir. API'deki katılım puanı kazanç gibi gösterilmez; uydurma +50/-20 ve “10dk önce” kaldırıldı. Geçersiz tarih “Tarih bilgisi yok” olarak görünür.
- Envanter ve geçmiş için bağımsız loading, gerçek empty, error ve success durumları var. Hatalarda form içi yeniden yükleme düğmeleri bulunur; başarılı diğer bölüm tekrar istenmez.
- Loading `role=status`, hata `role=alert`, içerik semantik region/list/time kullanır. Yeniden yükleme sırasında kaldırılan düğme odağı kaybolmasın diye odak ilgili bölüme taşınır. Düğmeler en az 44 px yüksekliğinde.
- Profil veri ve bölüm hata metni ink rengine alındı; kırmızı hata vurgusu kenarlıkta tutuldu. Yeni küçük hata metinlerinde redox/kağıt yaklaşık 4.08:1, ink/kağıt yaklaşık 17:1 kontrast verdi.
- Rakip profili “Bu oyuncunun ayrıntılı profili paylaşılmıyor.” açıklamasıyla sadeleşti. Kurgu ID, seviye, istatistik ve görüntüleyenin envanteri gösterilmez; avatar düzenleme açılmaz.
- Krem/pembe/mavi görsel kimlik, kağıt/ink kart, spacing, tipografi, mevcut dialog odağı/scroll sistemi korundu. Yeni animasyon eklenmedi; mevcut reduced-motion desteği sürüyor. Mobil, yatay mobil, tablet ve desktop içerik kaydırma/kapatma davranışı kontrol edildi.

## Teknik iyileştirmeler ve değişen dosyalar

- `hooks/useProfileData.ts`: yalnız açık ve kendi profiline istek, bağımsız kaynak durumları/yeniden deneme, kişi anahtarıyla görünür veri izolasyonu ve effect cleanup ile eski yanıtları yok sayma. Kapanınca özel veri görünmez, yeniden açılınca güncel veri alınır. Bölüm kaydı gereksiz veri refetch'i tetiklemez.
- `components/profile/ProfileActivity.tsx`: iki kaynak için semantik, responsive durumlar; son üç gerçek maç; doğrulanabilir kayıt tarihleri ve klavye retry odağı.
- `components/UserProfileModal.tsx`, `components/Dashboard.tsx`: açık preview kontratı, özel verinin yalnız sahibine render edilmesi, kurgu feed'in kaldırılması.
- `lib/api.ts`: geçmiş helper'ına `throwOnError` seçeneği; profil okumasında sunucu ve bozuk payload hataları iletilir. Diğer tüketicilerin mevcut fallback davranışı korunur.
- `hooks/useProfileData.test.ts`, `components/profile/ProfileActivity.test.tsx`, `components/UserProfileModal.test.tsx`, `lib/api.branch.test.ts`: gerçek veri, üç kayıt sınırı, yükleme bağımsızlığı, ayrı retry, geç yanıt/kişi değişimi, kapanma, malformed yanıt, privacy/preview ve tarih/outcome testleri.
- `e2e/profile-data.spec.ts`: iki tarayıcıda dört viewport; loading/error/keyboard retry; kendi profili→rakip geçişi; gerçek API'de yeni kullanıcı geçmişi ve envanter kullanılabilirliği. Mevcut E2E zaman aşımı değerleri değiştirilmedi.
- `e2e/player-dialogs.spec.ts`: bölüm hata assertion'ı yeni bağımsız envanter alert'inden ayrıldı; kayıt/odak kontratı korunuyor.
- Bu rapor.

Yeni dependency, endpoint, backend yetkisi, veritabanı şeması veya migration eklenmedi. Mevcut geçmiş sorgusu explicit kolonlarla en fazla 25 satır döndürüyor; profil üç satır gösteriyor. Profil açılışında bir ek history GET var; polling eklenmedi. Dashboard JS gzip yaklaşık 54.12→54.94 kB, giriş JS 114.81→114.96 kB. Core Web Vitals saha ölçümü yapılmadı.

## Doğrulama

- Son `npm run verify`: **exit 0**; audit **0 açık**, lint ve typecheck geçti, **115 suite / 1.352 test** geçti, production build **14.86 saniyede** tamamlandı. Son satır coverage %80.92; önceki turun yerel sonucu %80.85.
- Tüm Chromium + Firefox E2E: **100/100 geçti** (50'şer, 4.8 dakika). Önceki parola kurtarma, masa kodu, pencere odağı ve oyun/ödül akışları korundu. Test timeout değerleri artırılmadı.
- Son production build QA: iki tarayıcı × 320×568, 568×320, 768×1024, 1440×900 × dolu/boş/hata/loading/rakip görünümü = **40 panel kontrolü**. Bounds, yatay taşma, pencere odağı, Escape, özel veri isteklerinin engellenmesi ve hata düğmesinin iç scroll ile erişimi geçti; JS pageerror yok. Görüntüler incelendi. Retry sonrası Tab odağının aktif dialog içinde kaldığı iki tarayıcıda ayrıca doğrulandı.
- `git diff --check` geçti. `npm run migrate:status` çalıştı; yerel PostgreSQL erişilemediğinden uygulanan migration listesi doğrulanamadı. Şema değişikliği yok.
- İlk E2E denemesinde fixture'ın sorgu parametreli lobi URL'sini karşılamadığı ve eski tek-alert seçicisinin artık iki gerçek uyarıyla eşleştiği görüldü; seçiciler düzeltildi. Gerçek API kontrolü Store servisinin DB yokken hata döndürebileceğini açıkça doğrular. Son tam paket başarılıdır.
- WebKit/Safari doğrulanmadı; önceki yerel ICU kısıtı sürüyor. OS paketleri değiştirilmedi.

Log/görüntüler görev klasörünün `outputs/profile-data-*` dosyalarında. Bu commit dağıtım öncesi doğrulama kaydıdır; PR, CI ve canlı sonuçları yayın sonrasında `outputs/2026-10-02-profile-data-release.md` raporuna eklenecek.

## Kalan riskler ve sonraki yüksek etkili işler

1. Avatar görselleri harici DiceBear hizmetine bağlı; ilk yükleme/fallback ve görsel hata geri bildirimi bir sonraki ürün turunun güçlü adayı.
2. Önceki dağıtımda kısa 502 gözlendi; üretim servis geçişinin kesintisiz yapılması ayrı mühendislik turunda incelenmeli.
3. Rakip için gerçek halka açık istatistik istenirse açık bir public-profile API kontratı gerekir; bu tur paylaşılmayan özel geçmişe erişim eklenmedi.
4. Store envanter controller'ında memory fallback yok. Yerel DB yokken endpoint 500 döndürür; UI bunu hata olarak gösterir. Gerçek boş envanter, fixture ve unit/QA ile; gerçek geçmişin boşluğu API ile doğrulanır. Canlı DB sağlığı dağıtım sonrasında ayrı kontrol edilir.
5. WebKit yerel ICU kitaplığı eksikliği nedeniyle önceki turda çalışmadı; Safari/gerçek touch ve ekran okuyucu doğrulaması hâlâ gerekir. Tam WCAG uygunluğu veya ölçülmüş performans artışı iddia edilmiyor.
6. Confirmation, genel ve admin pencerelerinin kalan odak audit'i bu kapsam dışında.

Kalite ve veri güvenilirliği önceliklendirildi; sırf otomasyon için yeni özellik veya animasyon üretilmedi.
