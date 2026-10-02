# CafeDuo ürün kalite turu — 2 Ekim 2026, masa koduyla katılım

## Başlangıç durumu ve önceki çalışmalar

Önce `2026-10-02-password-recovery.md`, repository kuralları, son commitler, açık değişiklikler ve önceki dağıtım incelendi. Şifre yenileme ve yeni oyun kulübü ana sayfası yeniden yapılmadı.

Önceki yayın talebi tamamlandı: [PR #18](https://github.com/eminemrre/cafeduo-main/pull/18) birleşmiş; `79c39f5f7d596e16ee8e1c868f09acf6beaa0fe7` canlıda. [VPS dağıtımı](https://github.com/eminemrre/cafeduo-main/actions/runs/36931777186) başarılı. Canlı `/api/readiness` aynı sürümü, hazır veritabanını ve Redis'i doğruladı. API, web, PostgreSQL ve Redis konteynerleri sağlıklı. 390/768/1440 px ana sayfa, eksik şifre bağlantısından girişe/yeni bağlantıya dönüş ve mobil form hata odağı canlıda kontrol edildi; taşma ve başarısız font isteği yok. Üretim hesabının şifresi değiştirilmedi.

Bu turun başlangıcı `eb470d95f5a9ec6e45cd53dc33a35751939c8cdd` (birleşmiş yayının README badge güncellemesi). Güncel izole repository `work/release`, branch `fix/checkin-code-2026-10-02`. İlk turun `work/cafeduo-main` kopyası eski snapshot olarak korundu. Paylaşılan ana repository'deki kaydedilmemiş şifre yenileme dosyalarına dokunulmadı. Otomasyonun iki saatlik aralığı korundu; çalışma yolu güncel izole kopyaya taşındı.

## Önemli problemler

- Masa kodu konum izni olmadan giriş alternatifi olarak sunulmasına rağmen `checkIn` önce konum iznini ve GPS'i bekliyordu. Yanıtlanmayan izin istemi akışı durduruyor; GPS denemeleri 7 + 16 + 12 saniye sürebiliyordu. Önceki rapordaki Firefox giriş/check-in hatasının kaynağı buydu.
- Daha önce alınmış koordinatlar kodla birlikte gönderiliyordu. Sunucu, koordinat varsa geofence kontrolünü tercih ediyor; böylece kullanıcı kodla devam etmeyi seçse de farklı bir doğrulama yöntemi devreye giriyordu.
- Kod girilmişken hâlâ konum bekleme/izin metni gösteriliyor, koordinatın alınması sunucu doğrulaması tamamlanmış gibi anlatılıyordu.
- Katılım alanları semantik bir formda değildi; Enter ile gönderim yoktu. Kod açıldığında klavye odağı yeni alana taşınmıyordu. İstek sırasında masa/kod alanları ve ayrı konum işlemi kullanılabiliyordu.
- Framer Motion giriş hareketleri reduced-motion tercihini bu yüzeyde ayrıca dikkate almıyordu.

## Seçilen görevler ve öncelik gerekçesi

Masaya katılım, giriş ile oyun/ödül deneyimi arasındaki zorunlu adım. Bu adımın izin istemine takılmasını gidermek, kullanıcıyı vaat edilen alternatifle ilerletmek ve doğrulama geri bildirimini düzeltmek dekoratif eklemelerden daha yüksek değer taşıyor. Product/UX, görsel tasarım, mimari, performans, erişilebilirlik ve QA değerlendirmeleri bu tek akışta birleştirildi.

## UI/UX iyileştirmeleri

- Kod girilmişse durum metni “Masa koduyla doğrulanacak”; henüz doğrulanmış izlenimi vermiyor. Açıklama her iki yöntemi de anlatıyor. GPS başarı metni “Konum alındı”, başarısızlık metni “Konum alınamadı”.
- Enter ile gönderim yapan form, kodu açınca alana odak, yalnız durum satırında `role=status`, mevcut hata alanında `role=alert` ve formda `aria-busy` var. Tüm formun her alan değişikliğinde canlı bölge olarak okunması kaldırıldı.
- Bekleyen check-in sırasında kafe, masa, kod ve konum kontrolü kilitleniyor; kullanıcı istekle ekranda görünen seçimleri birbirinden koparamıyor. Hatalı kod korunuyor ve değiştirilerek yeniden denenebiliyor.
- Reduced-motion açıkken başlık/kart giriş hareketi ve gecikmesi kaldırılıyor. Yeni animasyon eklenmedi.
- Krem/pembe/mavi kimlik, kart genişliği, spacing ve CTA yerleşimi korundu. 320/390/768/1440 px kod akışı Chromium ve Firefox'ta incelendi; yatay taşma yok. Mobil, tablet ve desktop ekran görüntüleri kontrol edildi; navigasyon/form çakışması görülmedi.

## Teknik iyileştirmeler ve değiştirilen dosyalar

- `hooks/useCafeSelection.ts`: trim sonrası dolu kod varsa konum API'lerine hiç gitmeden yalnız kodu sunucuya gönderir. Eski koordinatlar da gönderilmez. Kod boşsa mevcut GPS akışı korunur. Sunucu doğrulama kuralları değiştirilmedi.
- `hooks/useCafeSelection.test.ts`: bekleyen/reddedilen/desteklenmeyen geolocation, eski koordinatların gönderilmemesi, boşluk içeren kodun GPS'e dönmesi ve sunucu reddinden sonra yeniden deneme için altı yeni senaryo. Mevcut GPS başarı/ret/timeout testleri korunuyor.
- `components/CafeSelection.tsx`: yöntemle tutarlı metinler, semantik form, alan odağı, bekleme kilidi, durum duyurusu ve reduced-motion.
- `components/CafeSelection.test.tsx`: bekleme kilidi ve yöntem duyurusu; kod senaryosunda geolocation çağrılmadığı doğrulanıyor.
- `e2e/checkin-code.spec.ts`: dört genişlikte klavye ile gerçek test backend'ine kodla giriş; API payload'ında koordinat olmaması ve konum API'lerinin hiç çağrılmaması; geçersiz kodun reddi ve düzeltme sonrası başarı. Beş test `@smoke` ile CI'a dahil.
- `docs/automation/2026-10-02-checkin-code.md`: bu rapor.

Yeni dependency, lockfile, CSS veya veritabanı değişikliği yok. GPS alternatifi seçilmediğinde gereksiz izin/GPS beklemesi kaldırıldı. Saha Core Web Vitals iyileşmesi ölçüldüğü iddia edilmiyor. Ana JS build'i 354.20 → 354.46 kB; gzip 114.64 → 114.78 kB. CSS ve Dashboard bundle boyutları aynı.

## Doğrulama

- `npm run verify`: başarılı; npm audit 0, lint, typecheck, 112 Jest paketi / 1337 test ve üretim build'i geçti.
- Hedefli hook/bileşen testleri: 27/27 başarılı. Altı yeni hook testi ve bir bileşen testi var.
- Yeni kod akışının son hedefli tarayıcı çalışması: Chromium 5/5, Firefox 5/5 başarılı. Gerçek yerel backend'in geçersiz kodu reddetmesi de kontrol edildi.
- Son tam Playwright çalışması: **72/72 başarılı**; Chromium 36/36, Firefox 36/36. Önceki turda başarısız olan Firefox giriş/check-in/çıkış testi artık başarılı. Kayıt, giriş, check-in, mobil panel, oyun, mağaza, ödül çarkı, turnuva ve işletme akışları dahil.
- İlk tarayıcı denemesinde testin reduced-motion tercihi uygulanmıyordu; `page.emulateMedia` ile açıkça ayarlandı ve `matchMedia` assertion'ı eklendi. Payload assertion'ına API istemcisinin mevcut `cafeId` alanı dahil edildi. Bu test düzeltmelerinden sonra beş yeni senaryo her iki motorda yeniden geçti; test timeout'ları artırılmadı.
- WebKit önceki turda `libicudata.so.74` eksikliği nedeniyle başlatılamamıştı. Bu tur sistem paketleri değiştirilmedi; Safari motoru doğrulandı denmiyor.
- Değişen altı dosyada Prettier kontrolü ve `git diff --check`: başarılı.

Kanıtlar bu görevin `outputs/` dizininde: `checkin-unit.log`, `checkin-verify.log`, `checkin-e2e.log` (ilk deneme), `checkin-e2e-targeted.log`, `checkin-e2e-final.log`, `checkin-{320,390,768,1440}-{chromium,firefox}.png`. Önceki yayının kanıtları `live-release-audit.json`, `live-release-verification.log` ve `live-home-*.png`.

## Kalan riskler ve sonraki işler

- Masa kodu geçerli olmalı; sunucu reddi kullanıcıya gösteriliyor. Bu tur backend doğrulamasını değiştirmedi. Yerel E2E bellekteki veri deposuyla çalışıyor; veritabanı yolu mevcut backend birim testleriyle kontrol ediliyor.
- Fiziksel iOS/Android, gerçek kafe GPS koşulları ve Safari motoru henüz bu turda doğrulanmadı. Üretim hesabıyla check-in yapılmadı.
- Kullanıcı ayrı konum düğmesini özellikle seçerse mevcut GPS timeout/fallback davranışı sürüyor. Bu tur kod yönteminin o isteğe bağımlılığını kaldırıyor.
- Sonraki yüksek etkili audit: ortak modal ve oyun/avatar diyaloglarında başlangıç odağı, Tab döngüsü, kapanış odağı ve küçük ekran kaydırması. Ölçülen bir sorun bulunursa düzelt; şifre yenileme veya bu kod akışını sebepsiz yeniden tasarlama.
- Canlı dağıtım sonucu PR/CI ve readiness ile ayrıca doğrulanmalı; yayın kanıtı `outputs/2026-10-02-checkin-release.md` dosyasında tutulacak. Bu rapor yayın öncesi kontrol kaydıdır.
