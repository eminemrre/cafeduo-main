# CafeDuo Yol Haritası

## Güncel Durum

| Metrik | Değer |
|--------|-------|
| Proje Puanı | 84/100 |
| Test Coverage | 542/542 tests passing |
| Deployment | cafeduotr.com (live) |
| Backend | CommonJS (Node.js) |
| Frontend | TypeScript + React |
| Database | PostgreSQL + Redis |

---

## Tamamlanan Çalışmalar

### Sprint 1 - Performans & Güvenlik ✅

**Tamamlanma: Şubat 2024**

- `SELECT *` anti-pattern düzeltildi - Tüm sorgular explicit column kullanıyor
- N+1 achievement sorguları optimize edildi - CTE ve JOIN kullanımı
- Frontend polling 4s → 15s - Socket.IO `lobby_updated` event kullanımı
- Redis `KEYS(pattern)` → `SCAN()` migration
- Cache invalidation sistemi güncellendi

**Detaylar:** [`docs/SPRINT_1_SUMMARY.md`](SPRINT_1_SUMMARY.md), [`docs/OPTIMIZATIONS.md`](OPTIMIZATIONS.md)

### Sprint 2 - Kod Kalitesi ✅

**Tamamlanma: Şubat 2024**

- JWT claims minimize edildi (payload boyutu %60 azaltıldı)
- CI/CD pipeline aktif (GitHub Actions)
- Database migration sistemi kurulu (`node-pg-migrate`)
- Performance indexes eklendi
- Test coverage artırıldı

**Detaylar:** [`docs/SPRINT_2_SUMMARY.md`](SPRINT_2_SUMMARY.md)

### Güvenlik Düzeltmeleri ✅

**Tamamlanma: Şubat 2024**

- JWT → httpOnly Cookie migration (XSS koruması)
- Socket.IO auth middleware (token validation)
- Token blacklist sistemi (Redis-backed)
- CSRF koruması (SameSite cookies)
- Rate limiting (Redis-backed)

**Detaylar:** [`docs/COOKIE_MIGRATION_ANALYSIS.md`](COOKIE_MIGRATION_ANALYSIS.md), [`plans/archive/JWT_COOKIE_MIGRATION_PLAN.md`](../plans/archive/JWT_COOKIE_MIGRATION_PLAN.md)

---

## Öncelikli Yapılacaklar

### 🔴 KRİTİK (Hemen Yapılmalı)

#### 1. Git Secrets Temizliği
- **Durum:** Manuel süreç gerekiyor
- **Aksiyon:** `git-filter-repo` ile geçmişten credential temizliği
- **Öncelik:** Güvenlik açığı var
- **Referans:** [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md)

#### 2. gameHandlers.js Refactoring
- **Durum:** 2286 satır - çok büyük
- **Hedef:** Modüler yapıya geçiş (<300 satır per module)
- **Öneri:** Game type'lara göre ayrı handler'lar
- **Dosya:** [`backend/handlers/gameHandlers.js`](../backend/handlers/gameHandlers.js)

**Önerilen Yapı:**
```
backend/handlers/
├── gameHandlers.js (orchestrator)
├── chess/
│   ├── index.js
│   ├── moveHandler.js
│   └── stateHandler.js
├── tank/
│   ├── index.js
│   └── moveHandler.js
└── shared/
    ├── validation.js
    └── stateManager.js
```

### 🟡 YÜKSEK (Bu Sprint)

#### 1. Dokümantasyon Konsolidasyonu
- **Durum:** 20+ MD dosyası, bazıları duplicate
- **Hedef:** Tek kaynak oluşturma
- **Aksiyon:**
  - `docs/` ana dokümantasyon
  - `docs/adr/` architecture decisions
  - `plans/archive/` tamamlanan planlar
  - Duplicate dosyaları temizle

#### 2. Backend TypeScript Migration
- **Durum:** Backend CommonJS, frontend TypeScript
- **Hedef:** Tüm proje TypeScript
- **Fayda:** Type safety, better IDE support
- **Risk:** Büyük refactor, dikkatli planlama gerekli

**Önerilen Adımlar:**
1. `@ts-check` JSDoc annotations ile başla
2. `backend/` → `.ts` uzantısına geçiş
3. CommonJS → ES modules migration
4. Build pipeline güncelleme

#### 3. Social Games Multiplayer
- **Durum:** Spec hazır, implementation bekliyor
- **Oyunlar:** Okey 101, Uno, Monopoly
- **Referans:** [`docs/SOCIAL_GAMES_MULTIPLAYER_SPEC.md`](SOCIAL_GAMES_MULTIPLAYER_SPEC.md)

### 🟢 ORTA (Sonraki Sprintler)

#### 1. PWA Desteği
- **Durum:** Vite 7 incompatibility nedeniyle devre dışı
- **Aksiyon:** `vite-plugin-pwa` güncellemesini bekle
- **Fayda:** Offline support, installable app

#### 2. Monitoring & Alerting
- **Öneri:** Sentry (error tracking), Datadog (APM)
- **Hedef:** Production issues için erken uyarı
- **Metrikler:** Error rate, response time, DB pool usage

#### 3. Performance Optimization
- **Frontend:** Code splitting, lazy loading
- **Backend:** Query optimization, caching
- **Database:** Index tuning, partitioning

---

## Tahmini Timeline

| Hafta | Görev |
|-------|------|
| 1-2 | Git secrets temizliği, gameHandlers refactoring |
| 3-4 | Dokümantasyon konsolidasyonu, TS migration başlangıcı |
| 5-6 | Social games multiplayer implementation |
| 7+ | PWA, monitoring, performance optimization |

---

## Teknik Borç

| Öğe | Öncelik | Tahmini Süre |
|-----|---------|--------------|
| gameHandlers.js refactoring | 🔴 Kritik | 2-3 gün |
| Git secrets temizliği | 🔴 Kritik | 1 gün |
| Backend TypeScript migration | 🟡 Yüksek | 1-2 hafta |
| Dokümantasyon konsolidasyonu | 🟡 Yüksek | 2-3 gün |
| Social games multiplayer | 🟡 Yüksek | 1-2 hafta |
| PWA desteği | 🟢 Orta | 1 hafta |
| Monitoring & alerting | 🟢 Orta | 3-5 gün |

---

## İlgili Dokümanlar

- [`AGENTS.md`](../AGENTS.md) - Geliştirici kuralları ve best practices
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) - Detaylı geliştirme planı
- [`docs/PROJECT_HEALTH.md`](PROJECT_HEALTH.md) - Proje sağlık raporu
- [`docs/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) - Güvenlik denetimi

---

## Notlar

- Bu yol haritası canlı bir dokümandır - düzenli güncellenir
- Sprint öncelikleri proje ihtiyaçlarına göre değişebilir
- Her sprint sonunda [`docs/SPRINT_X_SUMMARY.md`](SPRINT_1_SUMMARY.md) oluşturulur
