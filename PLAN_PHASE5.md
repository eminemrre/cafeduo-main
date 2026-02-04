# 🧪 Faz 5: Testing & QA - Detaylı Plan

> **Hedef:** CafeDuo'yu production-ready kaliteye ulaştırmak
> **Süre:** 6 gün (23 Şubat - 1 Mart 2026)
> **Branch:** `feat/phase-5-testing`

---

## 📋 Gün Gün Plan

### Gün 1: Setup & Configuration (Pazartesi)
**Süre:** 8 saat

#### Morning (4h) - Jest Setup
- [ ] Jest + React Testing Library kurulumu
  ```bash
  npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
  ```
- [ ] `jest.config.js` oluşturma
- [ ] `setupTests.ts` yapılandırması
- [ ] Test script'lerini `package.json`'a ekleme
- [ ] İlk test çalıştırma (smoke test)

#### Afternoon (4h) - Mock & Utilities
- [ ] API mock setup (`msw` - Mock Service Worker)
  ```bash
  npm install --save-dev msw
  ```
- [ ] Test utility fonksiyonları
  - `renderWithProviders()` - Context'lerle wrap etme
  - `createMockUser()` - Mock user factory
  - `createMockGame()` - Mock game factory
- [ ] Test fixtures (sabit test verileri)
- [ ] Coverage reporting setup (`--coverage`)

**Çıktı:**
- `jest.config.js`
- `src/test/setup.ts`
- `src/test/utils.tsx`
- `src/test/fixtures.ts`
- `src/mocks/handlers.ts`
- İlk test: `App.test.tsx` (smoke test)

---

### Gün 2: Unit Tests - Components (Salı)
**Süre:** 8 saat | **Hedef:** %40 coverage

#### Morning (4h) - Auth Components
- [ ] `AuthModal.test.tsx`
  - Login form validation
  - Register form validation
  - Mode switching (login ↔ register)
  - Error message display
  - Loading state
  
- [ ] `RetroButton.test.tsx`
  - Click handler
  - Variant styles
  - Disabled state
  - Loading state

#### Afternoon (4h) - Dashboard Components
- [ ] `StatusBar.test.tsx`
  - User info display
  - Points display
  - Table code display
  
- [ ] `GameSection.test.tsx`
  - Empty state
  - Loading state
  - Game list rendering
  - Create game button
  
- [ ] `RewardSection.test.tsx`
  - Shop tab
  - Inventory tab
  - Empty states
  - Buy button disabled state

**Çıktı:**
- `components/__tests__/*.test.tsx`
- Coverage raporu: %40+

---

### Gün 3: Unit Tests - Hooks & Utils (Çarşamba)
**Süre:** 8 saat | **Hedef:** %60 coverage

#### Morning (4h) - Custom Hooks
- [ ] `useGames.test.ts`
  - Game creation
  - Game joining
  - Loading states
  - Error handling
  - Socket event handling
  
- [ ] `useRewards.test.ts`
  - Rewards loading
  - Inventory loading
  - Buy reward
  - Points update

#### Afternoon (4h) - Context & Utils
- [ ] `AuthContext.test.tsx`
  - Login
  - Logout
  - Token validation
  
- [ ] `ToastContext.test.tsx`
  - Toast creation
  - Toast auto-dismiss
  - Toast stacking
  
- [ ] `lib/api.test.ts`
  - API calls
  - Error handling
  - Token attachment

**Çıktı:**
- `hooks/__tests__/*.test.ts`
- `contexts/__tests__/*.test.tsx`
- `lib/__tests__/*.test.ts`
- Coverage raporu: %60+

---

### Gün 4: Integration Tests (Perşembe)
**Süre:** 8 saat | **Hedef:** API flow coverage

#### Morning (4h) - Auth Flow
- [ ] Register → Login → Dashboard flow
- [ ] Token expiration & refresh
- [ ] Logout
- [ ] Protected routes

#### Afternoon (4h) - Game Flow
- [ ] Create game flow
  - Check-in → Create game → Join game → Play
  
- [ ] Shop flow
  - View rewards → Buy reward → Check inventory
  
- [ ] Error scenarios
  - Network error
  - Server error (500)
  - Validation error (400)
  - Unauthorized (401)

**Çıktı:**
- `tests/integration/auth.test.ts`
- `tests/integration/game.test.ts`
- `tests/integration/shop.test.ts`

---

### Gün 5: E2E Tests - Playwright (Cuma)
**Süre:** 8 saat | **Hedef:** Critical path coverage

#### Morning (4h) - Setup & Auth
- [ ] Playwright kurulumu
  ```bash
  npm init playwright@latest
  ```
- [ ] Test fixtures (test users)
- [ ] Page Object Model setup
  - `LoginPage.ts`
  - `DashboardPage.ts`
  - `GamePage.ts`

#### Afternoon (4h) - E2E Scenarios
- [ ] Happy path: Register → Login → Create Game → Play
- [ ] Shop flow: Buy item → Verify inventory
- [ ] Error scenarios: Invalid login, insufficient points
- [ ] Mobile responsive tests

**Çıktı:**
- `e2e/auth.spec.ts`
- `e2e/game.spec.ts`
- `e2e/shop.spec.ts`
- `e2e/pages/*.ts`

---

### Gün 6: CI/CD & Final QA (Cumartesi)
**Süre:** 6 saat | **Hedef:** %70 coverage + CI integration

#### Morning (4h) - CI/CD Integration
- [ ] GitHub Actions workflow güncelleme
  - Test stage ekleme
  - Coverage reporting
  - Parallel test execution
  
- [ ] Pre-commit hooks
  - Husky kurulumu
  - Lint-staged
  - Test on commit (unit tests only)

#### Afternoon (2h) - Final QA
- [ ] Coverage raporu analizi
- [ ] Eksik test'lerin tamamlanması
- [ ] Flaky test'lerin düzeltilmesi
- [ ] Test dokümantasyonu

**Çıktı:**
- `.github/workflows/test.yml`
- `.husky/pre-commit`
- Final coverage raporu: %70+
- `TESTING.md` dokümantasyonu

---

## 📁 Dosya Yapısı

```
/src
├── test/
│   ├── setup.ts              # Jest setup
│   ├── utils.tsx             # Test utilities
│   ├── fixtures.ts           # Mock data
│   └── mocks/
│       ├── handlers.ts       # MSW handlers
│       └── server.ts         # MSW server
│
├── components/
│   └── __tests__/
│       ├── AuthModal.test.tsx
│       ├── RetroButton.test.tsx
│       ├── StatusBar.test.tsx
│       ├── GameSection.test.tsx
│       └── RewardSection.test.tsx
│
├── hooks/
│   └── __tests__/
│       ├── useGames.test.ts
│       └── useRewards.test.ts
│
├── contexts/
│   └── __tests__/
│       ├── AuthContext.test.tsx
│       └── ToastContext.test.tsx
│
├── lib/
│   └── __tests__/
│       └── api.test.ts
│
/tests
└── integration/
    ├── auth.test.ts
    ├── game.test.ts
    └── shop.test.ts

/e2e
├── pages/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── GamePage.ts
├── auth.spec.ts
├── game.spec.ts
└── shop.spec.ts
```

---

## 🛠️ Kullanılacak Araçlar

### Test Framework
- **Jest** - Unit & Integration tests
- **React Testing Library** - Component testing
- **Playwright** - E2E testing
- **MSW** - API mocking

### Coverage & Quality
- **Istanbul/nyc** - Code coverage
- **Codecov** - Coverage reporting (opsiyonel)
- **stryker-js** - Mutation testing (ileri seviye)

### CI/CD
- **GitHub Actions** - Automated testing
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting

---

## 📊 Coverage Hedefleri

| Kategori | Hedef | Minimum |
|----------|-------|---------|
| Statements | %70 | %60 |
| Branches | %65 | %55 |
| Functions | %75 | %65 |
| Lines | %70 | %60 |

### Dosya Bazlı Hedefler

**High Priority (Test edilmeli):**
- ✅ `AuthModal.tsx` - %90
- ✅ `useGames.ts` - %85
- ✅ `useRewards.ts` - %85
- ✅ `api.ts` - %80

**Medium Priority:**
- ✅ `Dashboard.tsx` - %70
- ✅ `GameLobby.tsx` - %70
- ✅ `ToastContext.tsx` - %80

**Low Priority (Opsiyonel):**
- `Skeleton.tsx` - %50
- `EmptyState.tsx` - %50

---

## ⚠️ Riskler & Çözümler

| Risk | Olasılık | Etki | Çözüm |
|------|----------|------|-------|
| Socket.IO test karmaşası | Yüksek | Orta | Mock socket with `socket.io-mock` |
| Async test flakiness | Orta | Yüksek | `waitFor`, `findBy` kullanımı |
| Backend dependency | Orta | Orta | MSW ile tam mock |
| Time constraints | Düşük | Yüksek | Önceliklendirme (High priority first) |

---

## 🎯 Başarı Kriterleri

- [ ] %70+ code coverage
- [ ] Tüm critical path'ler test edildi
- [ ] CI/CD'de test stage çalışıyor
- [ ] Pre-commit hook aktif
- [ ] E2E test'ler stabil
- [ ] Dokümantasyon tamamlandı

---

## 📝 Günlük Rapor Şablonu

Her gün sonunda:
```markdown
## Gün X - Tarih

### Tamamlananlar
- [ ] Görev 1
- [ ] Görev 2

### Coverage
- Statements: %XX
- Branches: %XX
- Functions: %XX

### Sorunlar
- Sorun 1: Çözüm

### Yarın
- Planlanan görevler
```

---

## 🚀 Başlangıç Checklist

- [ ] Yeni branch oluştur: `feat/phase-5-testing`
- [ ] Jest kurulumu
- [ ] İlk test yaz ve çalıştır
- [ ] Coverage raporu al
- [ ] AGENTS.md güncelle

---

**Hazırlandı:** 2026-02-03  
**Başlangıç:** Hemen  
**Bitiş:** +6 gün
