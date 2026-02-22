# 🗺️ CafeDuo Yol Haritası (Roadmap)

> **Son Güncelleme:** 2026-02-07  
> **Mevcut Faz:** Faz 6 + Faz 8 hazırlıkları 🔄  
> **Sonraki Faz:** Production Cutover (VPS + Domain) 🚀
>
> **Yeni:** Senior seviye uygulanabilir iyileştirme planı için `ROADMAP_SENIOR.md` dosyasına bak.

---

## 📊 Genel İlerleme

```
Faz 1: Security Hardening     ████████████ 100% ✅
Faz 2: Frontend Refactoring   ████████████ 100% ✅
Faz 3: UI Features            ████████████ 100% ✅
Faz 4: Responsive & Animation ████████████ 100% ✅
Faz 5: Testing & QA           ████████████ 100% ✅
Faz 6: Performance            ░░░░░░░░░░░░ 0%  ⏳
Faz 7: Advanced Features      ░░░░░░░░░░░░ 0%  ⏳
Faz 8: Production Ready       ███████░░░░░ 60% ⏳
```

---

## ✅ Tamamlanan Fazlar

### 2026-02-06 Production Baseline (In Progress) 🔄

- Render blueprint denemesi yapildi, sonrasinda VDS-only stratejiye gecisle kaldirildi.
- `deploy/docker-compose.prod.yml` eklendi (VPS icin production stack).
- `deploy/Caddyfile` eklendi (domain + TLS + reverse proxy + socket route).
- `.github/workflows/deploy-vps.yml` eklendi (SSH + rsync + docker compose deploy).
- `docs/deployment_runbook.md` lokalden canliya adim adim guncellendi.

### 2026-02-07 Production Hardening (In Progress) 🔄

- `scripts/smoke/prod-smoke.mjs` eklendi (health + auth + socket smoke).
- `deploy/scripts/smoke-vps.sh` eklendi (VPS local smoke).
- `deploy/scripts/rollback.sh` eklendi (backup restore + redeploy + smoke).
- `.github/workflows/deploy-vps.yml` backup + deploy sonrası smoke adımları ile güçlendirildi.
- `REQUEST_LOG_SLOW_MS` eklendi (`.env.example`, `deploy/.env.production.example`, compose env).
- CORS allowlist dev/test localhost originleri ile genişletildi (`backend/server.js`).
- `auth/me` için cache devre dışı bırakıldı (`backend/routes/authRoutes.js`) ve API `etag` kapatıldı.
- `npm run server` scripti sadece `backend/**/*` izleyecek şekilde güncellendi (nodemon restart flake azaltımı).
- Chromium E2E tekrar yeşile çekildi: `8/8` test passing.

### Faz 1: Güvenlik Hardening ✅
**Süre:** 5 gün | **Branch:** `feat/phase-1-security-hardening`

- JWT Authentication güçlendirme
- RBAC (Role-based access control)
- IDOR koruması
- PostgreSQL transactions & row locking
- Health check & graceful shutdown
- CI/CD pipeline (GitHub Actions)
- Docker konfigürasyonu

### Faz 2: Frontend Refactoring ✅
**Süre:** 4 gün | **Branch:** `feat/phase-2-frontend-refactor`

- Dashboard 659 satır → 150 satır
- Custom hooks (useGames, useRewards)
- Component extraction (StatusBar, GameSection, RewardSection)
- AuthContext ile prop drilling azaltma

### Faz 3: UI Features ✅
**Süre:** 3 gün | **Branch:** `feat/phase-3-ui-features`

- Toast notification sistemi
- Skeleton loading states
- Form validation (real-time)
- Empty states

### Faz 4: Responsive & Animation ✅
**Süre:** 4 gün | **Branch:** `feat/phase-4-responsive-ui`

- Mobile-first responsive design
- Framer Motion animations
- Touch-friendly UI
- Loading & shimmer effects

---

## 🚧 Gelecek Fazlar

### Faz 5: Testing & QA 🧪 ✅
**Süre:** Tamamlandı | **Branch:** `feat/phase-5-testing`

#### Tamamlananlar:
- [x] Unit test altyapısı (Jest + React Testing Library + ts-jest)
- [x] 261/261 test passing
- [x] Coverage raporu üretimi (`npm run test:coverage`)
- [x] Playwright E2E test şablonları (`e2e/auth.spec.ts`, `e2e/game.spec.ts`, `e2e/shop.spec.ts`)
- [x] GitHub Actions ile CI test workflow

#### Mevcut Durum:
- Unit test suite'leri: `components`, `hooks`, `contexts`, `lib`
- Toplam coverage (2026-02-06): Statements `%71.87`, Branches `%63.57`, Functions `%68.57`, Lines `%72.11`
- Modül durumu (2026-02-06):
  - Oyun modülü: `ReflexRush` `%98.3`, `ArenaBattle` `%90.76`, `OddEvenSprint` `%96.87` (line coverage)
  - Kafe paneli: `CafeDashboard` `%89.24`, `CafeSelection` `%82.81`
  - Çekirdek UI: `Navbar` `%80.85`, `StatusBar` `%100`
- Toplam coverage (2026-02-06, son tur): Statements `%75.34`, Branches `%66.44`, Functions `%73.80`, Lines `%75.79`
- Son eklenen kalite testleri: `ErrorBoundary`, `UserProfileModal`, `Toast`
- Sonraki hedef: Global coverage `%85` + Faz 6 performans iyileştirmeleri

---

### Faz 6: Performance Optimizations ⚡
**Tahmini Süre:** 3-4 gün | **Branch:** `feat/phase-6-performance`
**Bağımlılık:** Faz 5 tamamlanması

#### Hedefler:
- [ ] **Frontend Performance**
  - Code splitting (lazy loading)
  - Image optimization (WebP, lazy load)
  - Bundle analysis & optimization
  - Service Worker (offline support)

- [ ] **Backend Performance**
  - Database query optimization
  - Redis caching (session, game state)
  - Connection pooling
  - Rate limiting

- [ ] **Monitoring**
  - Lighthouse CI
  - Web Vitals tracking
  - Error tracking (Sentry)
  - Performance metrics dashboard

---

### Faz 7: Advanced Features 🚀
**Tahmini Süre:** 5-7 gün | **Branch:** `feat/phase-7-advanced-features`
**Bağımlılık:** Faz 6 tamamlanması

#### Hedefler:
- [ ] **Game Enhancements**
  - Turnuva sistemi
  - Elo rating sistemi
  - Oyun geçmişi & istatistikler
  - Replay/spectator mode

- [ ] **Social Features**
  - Arkadaş listesi
  - Özel mesajlaşma
  - Lobby chat
  - Bildirimler (push)

- [ ] **Cafe Admin Panel**
  - Cafe yönetimi (masa, menü)
  - İstatistikler (popüler oyunlar, kazançlar)
  - QR kod yönetimi
  - Promosyon kodları

- [ ] **Mobile App (PWA/Expo)**
  - React Native veya PWA
  - Push notifications
  - Offline mode

---

### Faz 8: Production Ready 🏁
**Tahmini Süre:** 3-4 gün | **Branch:** `feat/phase-8-production`
**Bağımlılık:** Faz 7 tamamlanması

#### Hedefler:
- [ ] **Infrastructure**
  - VPS/Cloud deployment (AWS/DigitalOcean)
  - Domain & SSL
  - CDN (CloudFlare)
  - Backup & monitoring

- [ ] **Documentation**
  - OpenAPI/Swagger docs
  - README güncelleme
  - Deployment guide
  - Contributing guide

- [ ] **Legal & Compliance**
  - Privacy Policy (GDPR)
  - Terms of Service
  - Cookie consent
  - Data retention policy

- [ ] **Launch Prep**
  - Beta testing program
  - Analytics (Google Analytics/Plausible)
  - Feedback mekanizması
  - Support sistemi

---

## 📅 Tahmini Zaman Çizelgesi

| Faz | Süre | Başlangıç | Bitiş | Durum |
|-----|------|-----------|-------|-------|
| 1. Security | 5 gün | Tamamlandı | Tamamlandı | ✅ |
| 2. Refactoring | 4 gün | Tamamlandı | Tamamlandı | ✅ |
| 3. UI Features | 3 gün | Tamamlandı | Tamamlandı | ✅ |
| 4. Responsive | 4 gün | Tamamlandı | **Bugün** | ✅ |
| 5. Testing | 6 gün | Tamamlandı | Tamamlandı | ✅ |
| 6. Performance | 4 gün | +6 gün | +10 gün | ⏳ |
| 7. Advanced | 7 gün | +10 gün | +17 gün | ⏳ |
| 8. Production | 4 gün | +17 gün | +21 gün | ⏳ |

**Toplam Kalan Süre:** ~21 gün (3 hafta)

---

## 🎯 Öncelik Sırası

### Yüksek Öncelik (Zorunlu)
1. ✅ Security Hardening
2. ✅ Basic UI/UX
3. ✅ Responsive Design
4. 🔄 Performance Optimization (sıradaki)

### Orta Öncelik (Önemli)
5. Test coverage iyileştirme
6. Advanced Features (Turnuva, Elo)

### Düşük Öncelik (Nice-to-have)
7. Mobile App
8. Cafe Admin Panel

---

## 🔄 Teknik Borçlar (Tech Debt)

| Öğe | Önem | Planlanan Faz |
|-----|------|---------------|
| Swipe gestures | Orta | Faz 7 |
| Pull-to-refresh | Düşük | Faz 7 |
| Image lazy loading | Yüksek | Faz 6 |
| Code splitting | Yüksek | Faz 6 |
| Database migration sistemi | Orta | Faz 5-6 |
| Soft delete implementation | Orta | Faz 6 |

---

## 📝 Notlar

- **Minimum Viable Product (MVP)** için Faz 5 yeterli
- **Beta Launch** için Faz 6 önerilir
- **Tam Ürün** için Faz 8 tamamlanmalı
- Her faz sonunda **code review** ve **demo** yapılacak
- **Agile** yaklaşım: 1 haftalık sprint'ler

---

**Hazırlayan:** CafeDuo Dev Team  
**Son Güncelleme:** 2026-02-07
