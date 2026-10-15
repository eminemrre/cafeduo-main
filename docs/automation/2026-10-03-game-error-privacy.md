# CafeDuo güvenlik ek raporu — 3 Ekim 2026, oyun hata yanıtı

## Audit, problem, seçilen görev ve öncelik

PR #25 hareketli landing page ve ortak hata kontratı main'e birleştikten sonra son statik güvenlik taramasında `createGameHandler` içindeki ayrı geçici debug yanıtı bulundu. Bu handler ortak helper'ı kullanmıyordu: oyun INSERT'i başarısız olduğunda SQL exception mesajı, code, detail, hint, column, table, routine ve position HTTP 500 içindeki debug alanına koşulsuz konuyordu. Ortak helper düzeltmesi bu ayrı yolu kapatmıyordu; gerçek bilgi ifşasını gidermek yeni tasarım eklemekten öncelikli seçildi.

Başlangıç HEAD/origin/main `ab8080b`, temiz ağaç; dal `fix/game-error-privacy-2026-10-03`. Önceki landing, profil, avatar, dialog ve parola düzeltmeleri korunur. Ana repository'deki kaydedilmemiş çalışma ve eski snapshot'a dokunulmadı. Kullanıcının güvenlik ve canlı dağıtım yetkisi kapsamında bu açık son doğrulama öncesinde giderildi.

## Dosyalar ve iyileştirmeler

- `backend/handlers/game/handlers/createGameHandler.js`: geçici debug response/log bloğu kaldırıldı; onaylı `sendApiError` helper'ı kullanılır. Kullanıcıya güvenli `Oyun kurulamadı.` mesajı, INTERNAL_ERROR, details:null, status ve requestId döner. SQL/exception ayrıntıları ve arbitrary DB code kamuya çıkmaz. Transaction rollback ve bağlantı release korunur.
- `backend/handlers/game/handlers/createGameHandler.test.js`: mevcut hata testi private SQL fixture'ıyla güçlendirildi. Yanıtın tam güvenli kontratı, response/helper logunda private ayrıntı bulunmaması, requestId, rollback/release ve cache/lobby side-effect olmaması doğrulanır. Başarı, validation, check-in, stake, mevcut maç ve memory yolları mevcut testlerle sürer.
- Bu ek rapor.

UI/UX: hata mesajı anlaşılır kalır; SQL tanılaması arayüze aktarılmaz. Yeni görsel, animasyon, dependency, polling, state veya şema değişikliği yok. PR #25'in dört ekran boyutu, keyboard, reduced-motion ve katılım iyileştirmelerine dokunulmadı.

## Doğrulama

- npm run verify: exit 0; audit 0 açık, lint/typecheck başarılı; 118 suite / 1.386 test ve production build başarılı.
- Chromium oyun, landing-motion ve multiplayer settlement paketleri: 13/13, 49 saniye, exit 0. Timeout değiştirilmedi.
- git diff --check geçti. Ek frontend davranışı değiştirilmediği için önceki tam Chrome/Firefox 132 testin tamamı yeniden yerelde çalıştırılmadı; zorunlu CI smoke paketi yeniden çalışır. PR #25 production-build QA 16 senaryo / 48 ekran ve ilk canlı QA sonuçları ortak yayın kanıtında saklanır.
- DB hata yolu kontrollü yerel fixture ile test edildi; production'da DB hatası oluşturulmadı. Migration/DDL yok. Önceki yerel migration status DB erişim kısıtı ve WebKit ICU kısıtı sürer.
- Kanıtlar outputs/landing-error-\*; iki PR'ın CI, canlı revision/header/container, responsive ve depolama/API fallback kanıtları outputs/2026-10-03-landing-motion-security-release.md içinde tamamlanır.

## Kalan riskler ve sonraki işler

Bu kontrol tüm uygulamanın bağımsız pentest'i değildir. Ortak ve ayrı createGame 5xx SQL ifşaları kapatılır; validation/auth yanıtlarının yararlı kontratı korunur. Sunucu tarafından hesaplanması gereken eski PUT stat alanları, rate-limit startup memory fallback, yönetim paneli ağ sınırı ve kesintisiz servis geçişi sonraki yüksek etkili güvenlik/güvenilirlik adaylarıdır. Gerçek Safari/ekran okuyucu ve saha CWV ölçümü henüz tamamlanmadı. Yalnızca kanıtlı değer için değişiklik yapılmalı.
