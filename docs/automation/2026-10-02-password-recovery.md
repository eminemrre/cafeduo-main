# CafeDuo ürün kalite turu — 2 Ekim 2026

## Mevcut durum ve önceki çalışmalar

Başlangıç commit'i: `8294411`. Son kaynak değişiklikleri mobil font varlıklarını ve dağıtım sürecini düzeltmiş. Önceki görevde ana sayfa, giriş/kayıt, panel sekmeleri ve lobi arayüzü yenilenmiş; `docs/design/cafeduo-identity.md` güncel krem/pembe/mavi kimliği tanımlıyor. Bu çalışma tekrar yapılmadı.

İlk görev dizini boş olduğu için mevcut repository bulundu: `/home/eminemre/Documents/Codex/2026-10-01/chatgpt-yi-nas-l-g-ncelliycem/work/cafeduo-main`. Eşzamanlı arayüz çalışmasını bozmamak için commit ve mevcut arayüz değişikliklerinin izole kopyası bu görevin `work/cafeduo-main` dizinine alındı. Önceki görevin değişiklikleri bu turun katkısı olarak sayılmıyor. Test sunucuları ayrı 5173/3301 portlarında, test hesapları ve bellekteki veri deposuyla çalıştırıldı.

Bu konuşmaya bağlı iki saat aralıklı otomasyon oluşturuldu: `cafeduo-r-n-ve-ux-iyile-tirmeleri`. Sonraki turlar bu raporu, git durumunu ve önceki konuşma sonuçlarını okumalı. Bu turun ayrı branch'i `automation/password-recovery-2026-10-02`; kaynak/test katkısı izole repository'de commit olarak tutuluyor, ana repository'de mevcut arayüz çalışmasına uygulanmış durumda.

## Önemli problemler ve öncelik

Şifre yenileme, hesabına erişemeyen kullanıcının kritik geri dönüş yoluydu. Ana sayfa ve giriş yenilenmesine rağmen bu sayfa eski görsel dilde kalmıştı:

- Başlık beyaz (`#fff`), kart krem (`#fbf7ee`); okunabilirlik çok düşük. Hata/başarı mesajları da koyu zemin varsayan açık renklerdeydi.
- Eksik bağlantı ancak kullanıcı şifreleri yazıp gönderince bildiriliyordu.
- Başarıdan sonra form hâlâ gönderilebiliyor, giriş bağlantısı doğrudan giriş penceresini açmıyordu.
- Form yalnızca alt uzunluk sınırını kontrol ediyordu; sunucunun 72 karakter üst sınırı eksikti.
- Hata ve ilerleme durumları ekran okuyucuya duyurulmuyordu; alan hataları alanlarla ilişkilendirilmemişti.
- Aynı anda tekrar gönderim ve sayfada bağlantı değişirken eski isteğin tamamlanması korunmuyordu.

Bu akışı tamamlamak, yeni dekorasyon eklemekten daha yüksek kullanıcı değeri taşıyor. Ortak modal odak yönetimi ve işletme ekranları da incelendi; daha geniş değişiklikleri ayrı turda değerlendirmek uygun bulundu.

## Seçilen görevler ve UI/UX kazanımları

Şifre yenileme sayfası mevcut marka sistemine uyarlandı. Form, geçersiz bağlantı ve başarı ayrı durumlar olarak sunuluyor. Geçersiz bağlantıda boşuna şifre istenmiyor; kullanıcıya e-postadaki tam bağlantıyı açması veya giriş ekranından yeni bağlantı istemesi açıklanıyor. Başarıda form yerini tek giriş CTA'sına bırakıyor.

Kalıcı etiketler, 16 px giriş metni, en az 48 px alanlar, 44 px göster/gizle kontrolü ve sabit navbar altında yeterli boşluk var. Alan doğrulaması ilk hatalı alana odaklanıyor; `aria-invalid` ve `aria-describedby` hatayı açıklıyor. Sunucu hataları `alert`, kayıt ilerlemesi ve başarı `status` ile bildiriliyor. Başarı başlığına odak taşınıyor. Şifre göster/gizle durumu `aria-pressed` kullanıyor. İşlem sırasında alanlar kilitleniyor ve metinle geri bildirim veriliyor; ilerleme metni için ayrılan alan yerleşim kaymasını azaltıyor. Reduced-motion tercihinde kontroller hareket etmiyor.

320, 390, 768 ve 1440 px üretim ekran görüntüleri incelendi; yatay taşma ve navbar/kart çakışması yok. Üç marka fontu yüklendi, başarısız font isteği yok. Ölçülen kontrastlar: başlık 17.24:1, açıklama 7.01:1, sunucu hata metni 6.66:1, etiket 13.45:1. Bunlar incelenen metinler için AA eşiğini karşılıyor; tüm uygulamanın WCAG sertifikasyonu anlamına gelmez.

## Teknik kazanımlar ve değiştirilen dosyalar

- `components/ResetPasswordPage.tsx`: ortak Button/Input kullanımı, sunucuyla aynı 6–72 karakter doğrulaması, tekrar isteğe karşı senkron kilit, başarısız API yanıtını kontrol, bağlantı değişiminde form durumunu sıfırlayan keyed bileşen. Şifreler başarıdan sonra temizleniyor.
- `components/ResetPasswordPage.css`: yalnız `duo-recovery` kapsamında responsive görsel dil; route ile yüklenen küçük stylesheet.
- `components/ResetPasswordPage.test.tsx`: geçersiz bağlantı, iki uzunluk sınırı, eşleşme/boş tekrar, görünürlük, bekleyen istek, hata/yeniden deneme, başarısız API yanıtı ve eski istek sonucunu kapsayan 12 senaryo.
- `e2e/password-recovery.spec.ts`: dört genişlik, klavye/alan odağı, giriş/yeni bağlantı yönlendirmesi, başarı, gerçek test backend'iyle geçersiz token hatası ve reduced-motion için 8 test.
- `__mocks__/styles.cjs`, `scripts/automation/gen-jest-config.py`, `jest.config.js`: CSS importlarını çözemeyen, kurulu olmayan `identity-obj-proxy` referansı yerel CSS stub'ına değiştirildi. Jest ayarı repository kuralına göre generator üzerinden üretildi; coverage eşikleri korunuyor.
- `docs/automation/2026-10-02-password-recovery.md`: bu rapor ve sonraki tura aktarılacak bulgular.

Yeni dependency veya lockfile değişikliği yok. Vite şifre yenileme CSS'ini ayrı route varlığı olarak üretiyor: 2.50 kB / 0.88 kB gzip. Route JS'i 4.75 kB / 1.96 kB gzip. Bu ölçümler build çıktısına aittir; toplam bundle boyutunda veya Core Web Vitals'ta ölçülmüş iyileşme iddiası yok.

## Doğrulama

- `npm run verify`: başarılı; npm audit 0, lint, TypeScript, 111 Jest paketi / 1328 test ve üretim build'i geçti.
- Şifre yenileme birim testleri: 12/12 geçti; bileşen statement/line/function coverage %100, branch %94.54.
- Chromium tüm Playwright akışları: 30/30 geçti; kayıt, giriş/çıkış, check-in, mobil panel, oyun, ödül çarkı, mağaza, turnuva ve işletme yönetimi dahil.
- Firefox: 29/30 akış geçti; şifre yenilemenin 8/8 testi başarılı. Mevcut giriş/check-in/çıkış testi, konum isteğini beklerken 10 sn panel görünürlük eşiğinde başarısız oldu; tek başına tekrar da aynı sonucu verdi. `hooks/useCafeSelection.ts` bu turda değiştirilmedi: masa kodu verilse de önce konum tazelemesi bekleniyor; konum denemelerinin timeout'ları 7 + 16 + 12 sn. Bu, sonraki turun öncelikli mevcut UX/QA bulgusudur. Test timeout'u artırılarak gizlenmedi.
- WebKit: indirilmiş arşiv doğrulandı ve başlatma denendi; CachyOS üzerinde Ubuntu tarayıcı build'inin gerektirdiği `libicudata.so.74` bulunamadığından test çalıştırılamadı. Sistem paketleri değiştirilmedi.
- Prettier kontrolü ve `git diff --check`: başarılı.

İlk Jest denemesi eksik CSS mapper paketini ortaya çıkardı; mapper düzeltildikten sonra tüm suite tekrar geçti. İlk reduced-motion testi global 0.01 ms geçiş süresini sıfırla birebir karşılaştırıyordu; kullanıcının hareket tercihinin etkisini ölçen eşik kontrolüne düzeltildi. İlk izole geliştirme önizlemesindeki symlink font 403'leri, bağımlılıkların yerel kopyası ve üretim önizlemesiyle giderildi. Son görsel kontrolde başarısız font 0.

Test logları ve ekran görüntüleri bu görevin `outputs/` dizininde: `verify-2026-10-02.log`, `e2e-2026-10-02.log`, `e2e-firefox-2026-10-02.log`, `e2e-firefox-auth-recheck.log`, `integration-quality.log`, `integration-tests.log`, `recovery-visual-audit.json`, `recovery-{320,390,768,1440}.png`, `recovery-invalid-mobile.png`, `recovery-success-mobile.png`, `recovery-error-mobile.png`, `reset-before-mobile.png`.

## Repository entegrasyonu

Yalnız bu turun yedi kod/test dosyasını içeren patch ana repository üzerinde `git apply --check` ile doğrulandı ve uygulandı. Önceki görevin değişiklikleri korunuyor. Ana repository üzerinde `npm run quality` ve şifre yenileme testleri (12/12) tekrar geçti. Patch ayrıca bu görevin `outputs/password-recovery.patch` dosyasında; tekrar uygulanmamalı. Bu turda canlı dağıtım yapılmadı.

## Kalan riskler ve sonraki en yüksek etkili işler

- Başarılı sıfırlama isteği tarayıcı testinde kontrollü API yanıtıyla doğrulandı; gerçek backend'in geçersiz token yanıtı da test edildi. Gerçek e-posta teslimi ve üretim hesabıyla uçtan uca şifre değişimi bu turda denenmedi.
- Fiziksel iOS/Android cihaz testi ve saha Core Web Vitals ölçümü yapılmadı. WebKit sistem kütüphanesi eksikliği nedeniyle Safari motoru da doğrulanamadı.
- Firefox check-in akışı henüz geçmiyor; tüm E2E suite'inin eksiksiz başarılı olduğu iddia edilmiyor. Yeni şifre yenileme akışı her iki motorda başarılı.
- Repository'nin bu tur öncesindeki geniş, kaydedilmemiş arayüz revizyonu ayrı görevin çalışmasıdır; yayın durumu o görevden doğrulanmalı.
- İlk sonraki görev: Firefox'ta yinelenen check-in konum beklemesini gider; masa doğrulama kodunun sunucuda doğrulanması korunarak bu alternatifin gereksiz konum isteğine takılmamasını değerlendir. İzin verilmemesi, açık kalan izin istemi, GPS timeout ve geçersiz kod durumlarını test et.
- Ardından ortak `Modal` ve oyun/avatar diyaloglarının başlangıç odağı, Tab döngüsü, kapanış odağı, küçük ekran kaydırması ve reduced-motion davranışını tek kullanıcı yolculuğu olarak ele al. Şifre yenileme akışını gerçek bir regression veya ölçülmüş ihtiyaç yoksa tekrar tasarlama.
