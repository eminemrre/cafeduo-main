# CafeDuo Senior Improvement Roadmap

Son güncelleme: 10 Şubat 2026
Sahip: Core Product + Platform
Hedef dönem: 10 hafta
Durum: Uygulamaya hazır

## 1) Hedef

CafeDuo'yu 3 ana eksende üretim kalitesine taşımak:
- Gerçek zamanlı oyun doğruluğu
- Performans ve ölçeklenebilirlik
- Operasyonel güvenilirlik ve gözlemlenebilirlik

## 2) Başarı metrikleri (KPI)

Takip her sprint sonunda zorunlu.

| Alan | Metrik | Hedef |
|---|---|---|
| Realtime oyun | Oyun görünürlük gecikmesi (P95) | <= 1.2s |
| Realtime oyun | Çift oyuncu senkron hata oranı | < %1 |
| API | `/api/games` P95 | <= 250ms |
| Frontend | LCP (mobil) | <= 2.5s |
| Frontend | JS initial bundle | <= 280KB gz |
| Kalite | Test başarı oranı | %100 (bloklayıcı pipeline) |
| Stabilite | Prod hata oranı | < %0.5 |
| Güvenlik | Kritik açık | 0 |

## 3) Yol haritası (10 hafta)

### Faz A - Oyun doğruluğu ve veri tutarlılığı (Hafta 1-2)

Amaç: "Oyun kurdum ama görünmüyor" ve "rakip oynamadan sonuç oluştu" sınıfını kapatmak.

Teslimatlar:
- Tüm PvP oyunlarda server-authoritative sonuçlandırma.
- `liveSubmission` akışını oyun bazlı tek sözleşmeye sabitleme.
- `waiting -> active -> finishing -> finished` durum makinesi.
- Oyun yeniden bağlanma (`rejoin`) senaryosunda tek kaynak doğruluk (DB state).
- Oyun iptal/timeout/abandon kuralları.

Teknik görevler:
- `backend/handlers/gameHandlers.js` içindeki oyun akışlarını servis katmanına taşı.
- `game_state` için tek şema: `live`, `results`, `resolvedWinner`, `updatedAt`.
- Çift submit/idempotency koruması ekle (`submission_key`, son yazan kazanmaz, kurala göre birleşim).

Kabul kriteri:
- 2 farklı cihazla 30 ardışık PvP denemede görünmeme ve hayalet skor 0 olay.

### Faz B - Backend modülerleşme ve validation (Hafta 3-4)

Amaç: monolitik akışı bakımı kolay hale getirmek, bug riskini düşürmek.

Teslimatlar:
- Route, Service, Repository ayrımı.
- Zod/Joi ile tüm kritik endpoint'lerde request validation.
- Unified error format (`code`, `message`, `details`, `requestId`).
- Duplicate endpoint ve legacy code cleanup.

Teknik görevler:
- `backend/server.js` içinde domain bazlı modül sınırı.
- `backend/routes/*`, `backend/services/*`, `backend/repositories/*` yapısı.
- Transaction sınırları servis katmanına.

Kabul kriteri:
- `server.js` dosya boyutu ciddi düşmeli.
- Kritik endpoint'lerde validation coverage %100.

### Faz C - Performans ve ölçeklenebilirlik (Hafta 5-6)

Amaç: "şimşek gibi" deneyim ve çoklu kullanıcı altında stabilite.

Teslimatlar:
- Lobby ve aktif oyun sorguları için indeks optimizasyonu.
- Redis cache: lobby snapshots, hot leaderboards, kısa TTL.
- Socket.IO Redis adapter (multi-instance hazır).
- Polling frekanslarını adaptif hale getirme.

Teknik görevler:
- DB indeks: `games(status, table_code, created_at)`, `games(host_name, status)`, `games(guest_name, status)`.
- `EXPLAIN ANALYZE` raporu çıkarma ve regression guard.
- API response payload küçültme (yalnız gerekli alan).

Kabul kriteri:
- Lobby API P95 <= 250ms.
- 50 eşzamanlı kullanıcı simülasyonunda hata oranı < %1.

### Faz D - Frontend kalite ve UX bütünlüğü (Hafta 7-8)

Amaç: dashboard ve mobilde kesilme/sıkışma/senkron kopmaları bitirmek.

Teslimatlar:
- Dashboard responsive re-layout (min-width tuzaklarını temizleme).
- Mağaza/ödül panelinde adaptive columns.
- Profil düzenleme akışının uçtan uca stabilizasyonu.
- Rota bazlı lazy-load + skeleton + prefetch.

Teknik görevler:
- Büyük component'lerde hook extraction + memoization.
- Oyun ekranlarında tek tip "network degraded" state.
- Türkçe karakter/font fallback düzeni.

Kabul kriteri:
- Mobil 360px genişlikte kritik text clipping 0.
- Dashboard tab geçişlerinde runtime error 0.

### Faz E - Operasyon, güvenlik, release güvenliği (Hafta 9-10)

Amaç: canlıda güvenli release ve hızlı geri dönüş.

Teslimatlar:
- Structured logging + requestId + oyun id izleme.
- Sentry (frontend/backend) + alarm eşikleri.
- Canary veya blue/green release planı.
- Otomatik rollback kriterleri.

Teknik görevler:
- Deploy pipeline'a smoke + contract + realtime senaryo testi ekle.
- Güvenlik sertleştirme: rate limits, abuse guard, auth event audit.
- Yedek/geri yükleme tatbikatı.

Kabul kriteri:
- Deploy sonrası otomatik doğrulama başarısızsa rollback otomatik tetiklenmeli.
- Prod incident tespit süresi (MTTD) < 5 dk.

## 4) Test stratejisi (zorunlu kapılar)

Her merge için:
- Unit + integration pass
- Realtime E2E (2 kullanıcı, 2 tarayıcı profili)
- Load smoke (kısa ama zorlayıcı)
- Security lint + dependency audit

Her release için:
- Canary smoke
- Public smoke (`/health`, auth, socket handshake, game rejoin)
- Post-deploy replay test

## 5) Risk listesi ve azaltma planı

| Risk | Etki | Önlem |
|---|---|---|
| Socket reconnect tutarsızlığı | Oyun bozulması | Server state replay + ack mekanizması |
| Monolit refactor sırasında regresyon | Yüksek | Strangler pattern + feature flag |
| DB lock contention | Orta | Transaction sürelerini kısalt, doğru indeks |
| Mobil UI kırılması | Orta | Device matrix ile görsel regression test |
| Deploy drift (VPS ortam farkı) | Yüksek | Immutable deploy + env parity checklist |

## 6) Önceliklendirilmiş backlog (P0/P1/P2)

P0:
- Oyun state machine
- Server-authoritative sonuçlandırma
- Rejoin akışı stabilizasyonu
- Validation + unified errors

P1:
- DB indeks ve Redis cache
- Dashboard mobil layout düzeltmeleri
- Observability stack

P2:
- Turnuva/ELO/spectator hazırlığı
- Gelişmiş analitik ve segment deneyleri

## 7) Definition of Done

Bir iş "tamamlandı" sayılması için:
- Kod + test + dokümantasyon birlikte merge edilmiş olacak.
- Prod benzeri ortamda doğrulanmış olacak.
- İlgili KPI'da ölçülebilir iyileşme görülecek.
- Geri alma planı ve runbook güncel olacak.

## 8) Bu haftadan başlanacak ilk 10 iş

1. Oyun state machine sözleşmesini yaz ve dondur.
2. `makeMove` akışını servis katmanına ayır.
3. PvP oyunlar için replay/rejoin consistency testi ekle.
4. Lobby/active game sorgularına indeksleri uygula.
5. `games.list/get` payload küçültme.
6. Dashboard mobil clipping bug listesini kapat.
7. Profil güncelleme API + UI uçtan uca test.
8. Socket reconnect + ack mekanizması ekle.
9. Sentry kurulumunu CI ile entegre et.
10. Deploy pipeline’a canary smoke gate ekle.

## 9) Haftalık sprint planı (S1-S10)

Takvim karşılığı:

| Sprint | Tarih Aralığı (2026) |
|---|---|
| Sprint 1 | 10 Şubat - 16 Şubat |
| Sprint 2 | 17 Şubat - 23 Şubat |
| Sprint 3 | 24 Şubat - 2 Mart |
| Sprint 4 | 3 Mart - 9 Mart |
| Sprint 5 | 10 Mart - 16 Mart |
| Sprint 6 | 17 Mart - 23 Mart |
| Sprint 7 | 24 Mart - 30 Mart |
| Sprint 8 | 31 Mart - 6 Nisan |
| Sprint 9 | 7 Nisan - 13 Nisan |
| Sprint 10 | 14 Nisan - 20 Nisan |

### Sprint 1 (Hafta 1) - Oyun state machine ve sözleşme dondurma

Hedef:
- Oyun yaşam döngüsünü tek sözleşmede sabitlemek.

Backlog:
- `docs/game-state-machine.md` dosyasını oluştur.
- `backend/handlers/gameHandlers.js` için state geçiş doğrulama katmanı ekle.
- `openapi.yaml` içinde oyun state alanlarını sözleşmeye bağla.
- Rejoin davranışını açık şekilde tanımla (`active`, `finishing`, `finished`).

Çıktı:
- Dondurulmuş state diyagramı.
- En az 8 adet state transition test.

Kapanış kriteri:
- Geçersiz geçiş denemeleri API’de tutarlı 4xx dönmeli.

### Sprint 2 (Hafta 2) - Server-authoritative sonuçlandırma

Hedef:
- Client tarafı skor belirleyici olmasın, sunucu tek karar verici olsun.

Backlog:
- `lib/multiplayer.ts` tarafındaki fallback mantığını server result öncelikli yap.
- `scoreSubmission/liveSubmission` birleşiminde sunucu tarafı hakem kuralı ekle.
- Oyun bazlı finalizasyonu servis katmanına taşı.
- Çift submit/idempotency anahtarı (`submission_key`) uygula.

Çıktı:
- PvP oyunlarda winner yalnızca server üzerinden kesinleşmeli.
- Çift tıklama/yeniden gönderme kaynaklı tutarsızlıklar kapanmalı.

Kapanış kriteri:
- 2 cihazlı 30 denemenin tamamında winner tutarlı.

### Sprint 3 (Hafta 3) - Backend modülerleşme (Aşama 1)

Hedef:
- Monolitik handler ve route yükünü bölmek.

Backlog:
- `backend/services/gameService.js` oluştur.
- `backend/repositories/gameRepository.js` oluştur.
- `backend/routes/gameRoutes.js` içinde hafif route + service çağrısı modeline geç.
- `backend/server.js` içindeki oyun odaklı logic’i route katmanına çek.

Çıktı:
- Oyun domaini route/service/repository olarak ayrılmış olacak.

Kapanış kriteri:
- Oyun endpoint’leri için regression testler yeşil.

### Sprint 4 (Hafta 4) - Validation + unified error contract

Hedef:
- Kritik endpoint'lerde giriş doğrulama ve tek tip hata formatı.

Backlog:
- `backend/validators/*` altında şema doğrulamaları.
- `POST /api/games`, `POST /api/games/:id/join`, `POST /api/games/:id/move` validasyonları.
- Merkezi hata dönüştürücü middleware (`code`, `message`, `details`, `requestId`).
- `openapi.yaml` ile hata şemasını eşitle.

Çıktı:
- Kritik oyun endpoint’lerinde şema doğrulama.

Kapanış kriteri:
- Hatalı payload testleri beklenen formatta dönüyor.

### Sprint 5 (Hafta 5) - DB performans ve indeks

Hedef:
- Oyun/lobi sorgularında gecikmeyi düşürmek.

Backlog:
- `schema.sql` için indeks migration planı.
- `games` tablosunda status/table/created composite index.
- Active game lookup indeksleri (`host_name`, `guest_name`, `status`).
- `EXPLAIN ANALYZE` karşılaştırma raporu.

Çıktı:
- İndekslenmiş sorgu planı ve benchmark notları.

Kapanış kriteri:
- `/api/games` P95 hedefi test ortamında <= 300ms.

### Sprint 6 (Hafta 6) - Realtime ölçek hazırlığı

Hedef:
- Çoklu instance için socket katmanını hazırlamak.

Backlog:
- Socket.IO Redis adapter entegrasyonu.
- Reconnect + ack stratejisi.
- Oda üyeliği ve replay mekanizması sertleştirme.
- Realtime smoke test senaryosu CI’ya ekleme.

Çıktı:
- Multi-instance uyumlu realtime altyapı.

Kapanış kriteri:
- Bağlantı kopup geri gelmede oyun state kaybı yaşanmıyor.

### Sprint 7 (Hafta 7) - Dashboard mobil kalite

Hedef:
- Mobilde kesilen/sığmayan UI sorunlarını kapatmak.

Backlog:
- `components/Dashboard.tsx`, `components/dashboard/*` responsive düzen.
- `components/GameLobby.tsx` kart yapısında küçük ekran düzeni.
- Reward panelinde dar ekran adaptasyonu.
- Mobil görsel regression test seti.

Çıktı:
- 360px/390px/430px kırılımlarında temiz görünüm.

Kapanış kriteri:
- Kritik text clipping ve overflow 0.

### Sprint 8 (Hafta 8) - Frontend performans

Hedef:
- İlk yüklenme maliyetini düşürmek.

Backlog:
- Route bazlı lazy loading audit.
- Büyük chunk’lar için parçalama stratejisi.
- Gereksiz render noktalarında memoization.
- LCP etkileyen hero/dashboard alanında optimize asset kullanımı.

Çıktı:
- Bundle raporu ve iyileştirme sonrası fark tablosu.

Kapanış kriteri:
- Initial JS hedefi <= 280KB gz (veya mevcuta göre anlamlı düşüş).

### Sprint 9 (Hafta 9) - Observability ve prod güvenliği

Hedef:
- Hataları hızlı görüp etkisini azaltmak.

Backlog:
- Backend structured log + requestId korelasyonu.
- Frontend/backend Sentry olay yakalama.
- Alarm eşikleri (error rate, latency, socket disconnect).
- Güvenlik olayları için audit log.

Çıktı:
- İzlenebilirlik dashboard ve alarm seti.

Kapanış kriteri:
- Kritik hata oluştuğunda 5 dakika içinde görünür uyarı.

### Sprint 10 (Hafta 10) - Release safety ve rollback otomasyonu

Hedef:
- Riskli deploy’u güvenli hale getirmek.

Backlog:
- Canary release kapısı.
- Deploy sonrası otomatik smoke + contract check.
- Rollback tetikleyici kural seti.
- `deploy/scripts/rollback.sh` prosedür tatbikatı.

Çıktı:
- Tam otomasyonlu release güvenlik hattı.

Kapanış kriteri:
- Başarısız deploy’da otomatik rollback çalışıyor.

## 10) Sprint 1 yürütme panosu (hemen başlanacak)

Durum etiketleri:
- `todo`
- `in_progress`
- `blocked`
- `done`

Görev kartları:
1. `todo` - `docs/game-state-machine.md` oluştur ve state geçiş tablosunu yaz.
2. `todo` - Oyun state enum ve geçiş guard fonksiyonlarını backend’e ekle.
3. `todo` - `makeMove` içinde guard çağrısı ile geçiş doğrulaması yap.
4. `todo` - Geçersiz state geçiş testlerini `backend/handlers/gameHandlers.test.js` içine ekle.
5. `todo` - Rejoin davranışını API sözleşmesine ekle (`openapi.yaml`).
6. `todo` - Sprint demo checklist: create/join/rejoin/finish senaryolarını doğrula.
