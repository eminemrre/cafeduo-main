# CafeDuo — 3 Ekim 2026 15:51 UTC, kafe anlatımı ve güvenilir çıkış

## Audit ve önemli problemler

Güncel izole `work/release`, başlangıç ve son kaynak kontrolünde `origin/main` ile aynı `d36f133` commitindeydi (0/0). Git, son commitler, AGENTS.md ve önceki otomasyon/yayın raporları incelendi. Son doğrulanmış canlı uygulama revision'ı `21cce7c`; README badge head'i farklıdır. Önceki turun yerel son yayın raporu korunup bu turun kaynaklarına ekleniyor. Ana paylaşılan kopyadaki sekiz kaydedilmemiş değişiklik ve eski snapshot korunuyor.

Kafe landing'i uzun teknik FAQ metinleri ve doğrulanmamış vaatler içeriyordu: ölçülmemiş 3–5 MB/eski telefon performansı, 5 dakikalık oyun/15–30 dakika ek satış süresi, otomatik pilot hesabı/veri silme, GDPR uyumluluğu/resmi belge seti, screenshot ile kupon sahteciliğinin imkânsızlığı ve mevcut olmayan kasiyer rolü. FAQ bcrypt cost 12 derken kod 10 kullanıyor; role tipi yalnızca user/admin/cafe_admin. Günlük PIN/PDF süreçleri de mevcut uygulama davranışıyla doğrulanmıyordu.

Logout controller, merkezi iptal yazması başarısız olduğunda bile success:true döndürüyor ve ham Redis error nesnesini logluyordu. Bu nesne komut argümanında JWT içerebilir. Redis yok/hazır değilse production'da yerel bellek kaydı başarı gibi sunuluyordu. Cookie silme çağrısı setter'ın yedi günlük maxAge seçeneğini de taşıyordu.

Yeni HTTP regresyonu uygulamanın gerçek middleware sırasını incelemeyi gerektirdi: genel API rate limiter, authentication kontrolünden de önce isteği reddedebilir. Cihaz çıkışını korumak için geçerli CSRF kontrolünden sonra cookie cleanup'ı limiter'ın önünde hazırlamak; limiter, CSRF ve merkezi iptal kontrollerini korumak gerekiyor.

## Seçilen görevler ve öncelik

1. İşletme anlatımını sayfanın bütünü boyunca kısa ve mevcut ürünle uyumlu hale getirmek. Kullanıcının görünür teknik/şişirilmiş metin istememe tercihini korur; pilot kararına güvenilir bilgi verir.
2. Veri FAQ'sından gerçek Gizlilik Politikası linki eklemek ve mobil klavye yolculuğunu doğrulamak. Düz yazılmış route yerine erişilebilir, kullanılabilir bir eylem sağlar.
3. Sunucu oturum iptalini yalnızca Redis'in açık OK yanıtı alındığında başarılı saymak; cookie cleanup ile merkezi oturum iptalini ayırmak. Gerçek hata ve yeniden bağlanma durumunu gizlemez.
4. CSRF doğrulanmış çıkışta cihaz çerezlerini genel 429/503 yanıtından önce temizlemek. Genel rate limit bypass edilmez; geçersiz CSRF çerez silemez. Ortak sabit zamanlı CSRF karşılaştırması tekrar kullanılır.

## Değiştirilen dosyalar

- components/BusinessLanding.tsx
- e2e/landing.spec.ts
- backend/controllers/authController.js
- backend/controllers/authController.test.js
- backend/controllers/logout.integration.test.js
- backend/utils/tokenRevocation.js
- backend/middleware/csrf.js
- backend/middleware/logoutCleanup.js
- backend/routes/authRoutes.js
- backend/server.js
- docs/automation/2026-10-03-1551-owner-copy-logout.md
- Önceki tamamlanmış turun docs/automation/2026-10-03-1150-session-revocation-release.md kaydı.

## UI/UX iyileştirmeleri

Kurulum, adımlar, faydalar, pilot devamı ve beş FAQ cevabı sadeleşti. Uydurma süre/kazanç/Instagram sonuçları, jargon, olmayan rol ve otomatik süreçler kaldırıldı. Premium krem/pembe/kobalt kimlik, 3D hero, fiyatlar, gerçek WhatsApp/e-posta CTA'ları, hareketi durdurma ikonu, reduced-motion ve native details/summary korundu. FAQ dekoratif plus işareti ekran okuyucudan saklandı; gizlilik linki görünür focus ve klavye ile çalışır. Yeni animasyon, dekor veya gereksiz feature eklenmedi.

Product/UX, visual review, frontend architecture, performance, accessibility ve QA birlikte değerlendirildi. Sayfanın karar akışı iyileştirildi; yalnızca bir bileşenin süslenmesi hedeflenmedi. Yeni dependency/bundle katmanı yoktur.

## Teknik ve güvenlik iyileştirmeleri

Oturum iptal okumasını düzelten önceki isTokenRevoked politikası değiştirilmedi. Aynı servis yardımcı dosyasında revokeToken, token ömrü kadar TTL ve doğrulanmış Redis SETEX OK kullanır. Yapılandırılmış Redis hazır değilse/yazma hata verirse veya production'da store yoksa memory başarıya dönüş yoktur. Memory-only development desteklenir.

Logout başarı yanıtı artık doğrulanmış iptal veya zaten süresi dolmuş token içindir; yazma başarısızlığında 503/success:false ve genel hata kodu döner. Ham error/Redis komutu/JWT log ve yanıta aktarılmaz. Eski logout unit testindeki verify eksik mock'u, yanlışlıkla catch-success yolunu test ediyordu; gerçek verify ve bellek iptal kaydı kontrol edilerek düzeltildi.

Cihaz çerezleri yanıt gönderilmeden önce, orijinal domain/path/HttpOnly/Secure/SameSite seçenekleriyle, setter maxAge olmadan silinir. Çıkışa özel erken hazırlık, yalnızca ortak sabit zamanlı CSRF doğrulaması başarılıysa çalışır; generic API limiter yine çalışır. Normal route ve controller aynı cleanup'ı iki kez header'a yazmaz. Geçersiz CSRF mevcut rate-limit/CSRF hata yolunda kalır. Diğer route'ların middleware sırası ve limitleri değiştirilmedi.

JWT üretimi/secret, CSP/HSTS, oturum doğrulaması, role/yetki, Redis rate-limit politikası, schema, SQL ve dependency değişmedi. HTTP hata ayrıntıları, cookie/CSRF, rate-limit ve pinned SSH/CI dağıtım yapısı savunma odaklı incelendi. Üretimde saldırı, kesinti veya veri mutasyonu testi yapılmadı.

## Kontroller

- Son odaklı controller/logout/CSRF/iptal/route registry: **74/74**, beş suite.
- Yeni logout integration senaryoları **12**: gerçek JWT, cookie-parser, Express, CSRF, rate limiter, auth router ve kontrollü Redis; başarılı iptal sonrası HTTP/Socket.IO reddi, başarısız/eksik yazma onayı, auth-yazma arası reconnect, blacklist okuma hatası, global rate-limit 503/429, geçersiz CSRF, development ve production store politikası.
- Son `npm run verify`: **1441/1441**, **123 suite**, line coverage **%80,40**; lint/typecheck/build başarılı, audit **0**.
- Strict audit gate **0**; allowlist/eşik değişmedi. Prettier değiştirilmiş dosyalarda ve git diff --check başarılı.
- Son tam Chromium/Firefox Playwright **134/134**, **7,6 dakika**. Mobil FAQ açma → klavye ile privacy linki → gerçek /gizlilik başlığı akışı iki browser'da geçti.
- İlk UI/route değişikliğinden sonraki tam koşu ayrıca 134/134 geçti; genel limiter öncesi hazırlık eklendikten sonra son kaynak üzerinde tam koşu tekrarlandı. Sonuç iddiası son koşuya aittir.
- Production preview işletme **16/16**, Chromium/Firefox × 320×568, 568×320, 768×1024, 1440×900 × normal/reduced-motion: JS/CSP hatası/yatay taşma **0**; en yüksek Chromium CLS **0,001657**; 48 screenshot. 3D pause/keyboard/reduced-motion, fiyat ve CTA kontrolleri geçti.
- Beş FAQ'yı klavyeyle açma, gizlilik linkiyle gerçek sayfaya geçme ve 320/768/1440 px incelemesi ayrıca yapıldı. Görsel kanıt için ziyaretçinin cookie banner'ını normal Reddet eylemiyle kapatması kullanılır; ürün CSS'i capture için değiştirilmez.
- Migration status çalıştı; yerel PostgreSQL erişilemiyor. Yerel 11 pending dosya üretim durumu değildir; schema değişikliği yoktur.
- İlk HTTP test denemesi, hazırlanan kodda cleanup'ın finally ile response sonrasına kalmasını yakaladı; gönderim öncesine alındı. Sonraki fixture'a gerçek rate-limit adaptörünün eval yüzeyi eklendi. Bu erken denemeler geçti diye raporlanmıyor; yukarıdaki son kaynak testleri geçti.

## Kalan riskler ve sonraki yüksek etkili işler

Cihaz cookie cleanup'ı, uygulamaya ulaşan ve geçerli CSRF taşıyan çıkış isteğinde doğrulanır. Tam ağ/proxy/uygulama erişimsizliğinde HTTP-only cookie istemciden silinemez; sunucu iptali başarılı gibi sunulmaz. İstemci local cleanup davranışı mevcut halde kalır. Kalıcı logout intent/retry ve zaten açık uzun ömürlü socket'lerin expiry/iptal yaşam döngüsü sonraki güvenilirlik incelemeleridir.

Başarısız merkezi yazmada oturumun diğer servis örneklerinde iptal edildiği iddia edilmez; bu nedenle API başarısızlık bildirir. Redis kapalı hata politikası korunur. JWT 7 günlük mevcut ömür bu tur değiştirilmedi.

Safari/WebKit sistem kitaplığı ve fiziksel mobil GPU/enerji/CWV ölçümü sınırları önceki rapordaki gibi sürer. Three.js lazy chunk uyarısı korunuyor; yeni frontend dependency yok. Sonraki UX işi, gerçek pilot başvuru dönüşümü ve kullanıcı geri bildirimiyle karar vermektir; 3D tasarımı ölçümsüz tekrar değiştirmek veya metni yeniden şişirmek değildir.

## Yayın

Yerel kontroller geçti. Mevcut yetkilendirilmiş GitHub CI → Deploy VPS yolu kullanılacak; CI ve gerçek readiness revision/database/Redis ile doğrulanacak. Canlı responsive ve yeni privacy akışı yalnızca salt okunur misafir işlemleriyle kontrol edilecek. Bu kaynak raporu tek başına tamamlanmış canlı dağıtım iddiası değildir; nihai yayın raporunda gerçek kaynak/merge/CI/deploy ve browser kanıtları bulunacak.
