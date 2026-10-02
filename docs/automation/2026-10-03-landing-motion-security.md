# CafeDuo çalışma raporu — 3 Ekim 2026, hareketli landing page ve güvenlik

## Audit, seçilen görevler ve öncelik

Güncel `work/release` kopyasında HEAD/origin/main `7870f28`, 0/0 fark ve temiz ağaç doğrulandı; son commitler ve önceki raporlar incelendi. PR #18–24'ün parola, check-in, dialog, profil, avatar/cache ve dar profil kontratı korundu. Eski snapshot'a ve ana repository'deki 8 kaydedilmemiş girdiye dokunulmadı. Dal: `feat/landing-motion-security-2026-10-03`.

Kullanıcının yeni önceliği hareketli bir landing page ve güçlü güvenlik. Product/UX, bütün sayfanın katılım yolculuğu; visual review, krem/pembe/mavi kimlik; frontend/performance, animasyon yaşam döngüsü ve ilk yükleme; accessibility, klavye/hareket tercihi; QA, gerçek tarayıcı ve hata yolları birlikte değerlendirildi.

Önemli bulgular:

- Landing page hareket ve oyun geri bildirimi bakımından zayıftı; sayfa sonunda katılım eylemi yoktu. Giriş yapmış kullanıcının oyun CTA'sı kayıt modalını açıyordu.
- Küçük Games bölümü lazy yüklenirken üst düzey Suspense tüm landing page'i loader'a çeviriyordu. Production mobil ölçümde footer'ın büyük yer değiştirmesi yaklaşık 0,344 layout shift yarattı.
- Ortak API hata yardımcısı PostgreSQL tablo/sütun/routine/detail/hint ve exception mesajını herkese döndürüyordu; merkezi 5xx handler da açık ApiError ayrıntılarını yayımlayabiliyordu.
- Production API CSP script için unsafe-inline/unsafe-eval izinleri veriyordu. Frame embedding politika ve gereksiz tarayıcı izinleri sıkılaştırılabilirdi.
- Salt okunur canlı yapılandırma kontrolü, PostgreSQL'in varsayılan parola kullandığını gösterdi. DB/Redis/API dışarıya port yayımlamıyor; JWT en az 64 karakter, rate-limit Redis, store hata geçişi kapalı. Parola yenileme bu nedenle yüksek öncelikli gerçek kazanım seçildi.

## UI/UX iyileştirmeleri

- Oynanabilir tahtanın çevresinde mavi sahne, pembe kulüp damgası ve kahve kartı; başlıkta çizgi animasyonu. Oyun alanları ve klavye odağı hareket etmez.
- Taş hareketi, hamlenin başlangıç/hedefini ve otomatik rakip yanıtını gösterir; gerçek kurallar ve notasyon korunur. Yeni hamle gecikmesi/timer veya ayrı oyun mantığı eklenmedi.
- Scroll ile açılan içerik, ilerleme çizgisi, hover/focus/pressed geri bildirimi ve katılım yolculuğunu tamamlayan son CTA.
- Hareketi durdur/aç kontrolü, session bazında tercih, OS reduced-motion önceliği, görünmeyen sekmede durma, cleanup ve pasif scroll/rAF. Animasyon desteği veya storage yoksa içerik/katılım çalışır. Ortak Reveal de reduced-motion/API yokluğunda semantik düz HTML döndürür.
- Mobil 320×568, yatay 568×320, tablet 768×1024, desktop 1440×900 birlikte incelendi. Kahve kartının yardım metniyle örtüşmesi ilk görsel kontrolde bulunup giderildi. Dekorlar aria-hidden ve pointer-events:none; CTA, hit target ve odak sabit kalır.
- Giriş yapmış kullanıcı Games/son CTA üzerinden uygun rol paneline gider.

## Teknik iyileştirmeler ve değiştirilen dosyalar

- `components/LandingExperience.tsx`, testi: ortak hareket kontrolü, tercih, browser/visibility yaşam döngüsü, scoped IntersectionObserver ve scroll ilerlemesi.
- `App.tsx`: landing wrapper, kullanıcıya uygun katılım yönlendirmesi, reduced-motion route transition. Küçük Games statik import; gerçek ağır rota modülleri lazyWithRetry kullanmaya devam eder. İlk açılışta bütün landing'in loader'a dönmesi önlenir.
- `components/Hero.tsx`, `HowItWorks.tsx`, `Games.tsx`, `About.tsx`: bütün sayfa görsel ritmi ve katılım eylemleri.
- `components/ClubBoardPreview.tsx`, `styles/club.css`: sadece taş glyph'i hareketi ve hedef vurgusu; responsive sahne/reveal/feedback/reduced-motion stilleri.
- `components/ui/Reveal.tsx`: API bulunmadığında hata yerine görünür içerik; reduced-motion'da animasyonsuz semantik içerik.
- `backend/utils/routeHelpers.js`, testi; `backend/middleware/errorContract.js`, testi: kamuya açık 5xx yanıtlarında generic code/message, details:null ve correlation requestId; helper loglarında SQL/detail/exception mesajı yerine sınırlı tanılama. Merkezi özel sunucu logları mevcut stack/message kaydını korur.
- `backend/middleware/securityHeaders.js`, testi; `backend/server.js`: gerçek Helmet HTTP testleriyle production self-only script, frame-src/frame-ancestors none, X-Frame-Options DENY; development tooling izinleri development ile sınırlı.
- `deploy/Caddyfile`: aynı embedding koruması ve Permissions-Policy. QR kamera/konum kendi origin'inde izinli; microphone/payment/usb kapalı. Mevcut font/map/Sentry/WebSocket kaynakları korunur. CSS inline stilleri mevcut UI için devam eder; script unsafe-inline/eval production'da yoktur.
- `deploy/docker-compose.prod.yml`: production DB_PASSWORD zorunlu; change-me fallback kaldırıldı.
- `e2e/landing-motion.spec.ts`: dört viewport, keyboard oyun/pause, reload tercihi, OS tercih değişimi, API/storage yokluğu ve oturumlu katılım.
- Bu rapor.

Yeni dependency, polling, şema veya migration yok. Giriş JS gzip 115,00→116,95 kB; küçük Games chunk'ı ana girişe alındı. Animasyonlar transform/opacity üzerinde; dekorlar layout akışını değiştirmez.

## Canlı veritabanı parolası

Varsayılan parola canlı sunucuda 48 rastgele byte/384 bit entropy ile yenilendi. Değer terminale, rapora veya repository'ye yazılmadı; sunucudaki canonical ve aktif release .env dosyalarında mode 0600 ile saklandı. Deployment lock, özel sunucu yedeği ve başarısızlıkta eski credential/config/API geri yükleme yolu kullanıldı. Yeni parolayla ayrı SELECT 1 bağlantısı ve API restart sonrası public readiness/DB/Redis başarılı. Kaydedilen kanıt yalnızca boolean sonuçlar ve revision içerir: `outputs/landing-db-rotation.json`. Docker Config.Env içindeki PostgreSQL başlangıç değeri ancak sonraki deployment recreate ile güncellenir; gerçek parola doğrulaması yeni bağlantıyla yapılmıştır.

Yeni Compose için missing DB_PASSWORD rejection ve configured password acceptance gerçek Docker config --quiet ile geçti. Doğrulama geçici dosyalarda yapıldı; servis/data değişmedi.

## Doğrulama

- Son `npm run verify`: exit 0; audit 0 açık, lint/typecheck başarılı; 118 suite / 1.386 test; line coverage %81.46; production build başarılı.
- İlk unit motion testi ortamın stub sessionStorage'ı nedeniyle başarısızdı; test kurulumu gerçek Map-backed storage ile düzeltildi. Ürün storage failure davranışı ayrıca test edilir.
- İlk yeni Chromium E2E'de yanlış test API adı getByLabelText ve eski Footer Reveal'in eksik IntersectionObserver'da çökmesi bulundu. Test API adı ve ürün fallback'i düzeltildi. Sonuçlar aşağıdaki final kanıtında yer alır; başarısız ilk koşu tamamlanmış sayılmaz.
- İlk production QA, büyük CLS'yi yakaladı; Games eager import sonrası Chromium gözlemleri tüm viewportlarda 0,01'in altında. Saha CWV iddiası değildir. QA script keyboard seçiminin lazy chess yüklemesini beklemesi için aria-pressed senkronizasyonu kullanır; timeout artırılmadı.
- Production build Chromium + Firefox × dört viewport × normal/reduced motion = 16 senaryo, 48 ekran; keyboard/pause/reduced preference, yardım/dekor sınırları, oyun notasyonu, CTA/modal, yatay taşma, pageerror ve CSP violation kontrolleri geçti. Son ekranlar animasyonun tamamlanması beklenerek incelendi.
- Son kaynak ağacında tam Chromium 66/66 ve Firefox 66/66 (132 test, bu iki browser'da sıfır failure) geçti. Toplu komut ayrıca ortamda ICU runtime'ı bulunmayan WebKit'i başlattı; Chrome/Firefox tamamlandıktan sonra başarısız WebKit girişimleri durduruldu (aggregate exit 130). Bu nedenle tüm browser'lar veya toplu komut başarılı iddiası yapılmaz; ayrı önceki browser koşuları exit 0. Sayım kanıtı outputs/landing-final-e2e-results.json. PR/CI/canlı doğrulama `outputs/2026-10-03-landing-motion-security-release.md` içinde tamamlanır. Önceki ayrı browser koşuları Chromium 66/66, Firefox 66/66 geçti. Check-in timeout'ları değiştirilmedi.
- Yeni Caddy yapılandırması gerçek production Caddy binary'siyle reload etmeden validate edildi; başarılı. git diff --check geçti. migrate:status yerel PostgreSQL erişilemediğinden uygulanmış migration listesini doğrulayamadı; şema değişikliği yapılmadı. Deployment gerçek DB migration status/readiness kontrolünü yapar.
- Kanıtlar `outputs/landing-*`. Public production QA anonimdir; auth/me fixture kullanır, gerçek kullanıcı/oyun/ödül kaydı yazmaz. Canlıda saldırı/exploit/yoğun tarama yapılmadı.

## Otomasyon

Mevcut heartbeat aynı konuşmada ACTIVE tutuldu; aralık 4 saate güncellendi ve yeni landing/security öncelikleri prompt'a eklendi. GPT-6.1 Sol / High istenmiştir; heartbeat API bu iki alanı kabul etmediği için modelin değiştiği iddia edilmez. Konuşma modelinin arayüzden değiştirilmesi veya kullanıcının ayrı görev tercihinin gelmesi beklenir; ikinci bir aktif otomasyon oluşturulmadı.

## Kalan riskler ve sonraki yüksek etkili işler

- Hiç saldırı olmayacağı garanti edilemez. Bu tur ölçülmüş uygulama/yapılandırma zafiyetlerini giderir; bağımsız pentest, dış DDoS/WAF koruması ve tüm yetki yollarının eksiksiz audit'i yapılmış sayılmaz.
- Eski PUT /users/:id hâlâ client snapshot/stat alanları kullanıyor; sunucu tarafından hesaplanan istatistik mutasyonları ve yetki sınırları sonraki güvenilirlik/güvenlik audit'inin güçlü adayı.
- Rate-limit Redis hazır değilken başlangıçta memory fallback davranışı, yönetim panelinin ağ sınırı ve kesintisiz servis geçişi ayrı operasyon adayları.
- WebKit yerel ICU kısıtı, gerçek ekran okuyucu/touch, saha CWV ölçümü ve kalan genel/admin dialog odakları doğrulanmalı. Tam WCAG/CWV/ödül veya kusursuz güvenlik sonucu iddia edilmez.
- Sayfa olgunlaştıkça yalnızca kanıtlı değer için değişiklik; yeni dekor/animasyon eklemek otomasyonun zorunlu çıktısı değildir.
