# 🤖 CafeDuo - AI Agent Context

> **Bu dosya TÜM AI agent'lar tarafından OKUNMALIDIR.**
> Proje durumu, yapılanlar ve yapılacaklar burada tutulur.

---

## 📊 Proje Durumu (Son Güncelleme: 2026-02-03)

### ✅ Tamamlanan Fazlar

#### Faz 1: Güvenlik Hardening ✅ (TAMAMLANDI)
**Branch:** `feat/phase-1-security-hardening` (pushed to GitHub)

**Yapılanlar:**
- [x] JWT Authentication middleware güçlendirildi (DB validasyonu eklendi)
- [x] Role-based access control (RBAC) implementasyonu
  - `admin`, `cafe_admin`, `user` rolleri
  - `authenticateToken`, `requireAdmin`, `requireCafeAdmin`, `requireOwnership` middleware'leri
- [x] IDOR (Insecure Direct Object Reference) koruması
  - Shop endpoint'leri token'dan userId alıyor
  - Ownership verification eklendi
- [x] Race Condition çözümü
  - PostgreSQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`)
  - `FOR UPDATE` row locking
- [x] Duplicate API endpoint'ler temizlendi
- [x] Global error handling iyileştirildi
- [x] Health check endpoint eklendi (`/health`)
- [x] Graceful shutdown handlers eklendi
- [x] CI/CD pipeline oluşturuldu (`.github/workflows/ci.yml`)
- [x] Docker konfigürasyonları eklendi

**Dosyalar Değişti:**
- `backend/server.js` - Güvenlik hardening uygulandı
- `.env.example` - Production config eklendi
- `Dockerfile` + `Dockerfile.web` + `nginx.conf` eklendi
- `.github/workflows/ci.yml` eklendi
- `.cursorrules` güncellendi

**Test Sonuçları:**
```
✅ /api/admin/users -> 401 TOKEN_MISSING (güvenli)
✅ /api/shop/buy -> 401 TOKEN_MISSING (güvenli)
✅ /health -> 200 OK
```

---

### ✅ Tamamlanan Faz (Yeni)

#### Faz 2: Frontend Refactoring ✅ (TAMAMLANDI)
**Branch:** `feat/phase-1-security-hardening` (pushed to GitHub)

**Yapılanlar:**
- [x] Dashboard.tsx 659 satırdan ~150 satıra indirildi
- [x] 18 useState 3'e indirildi
- [x] Custom hooks oluşturuldu:
  - `useGames` - Oyun listesi ve aktif oyun yönetimi
  - `useRewards` - Mağaza ve envanter yönetimi
- [x] Component extraction:
  - `StatusBar` - Kullanıcı bilgileri ve istatistikler
  - `GameSection` - Oyun lobisi ve kurma/katılma
  - `RewardSection` - Mağaza ve envanter UI
- [x] AuthContext oluşturuldu (prop drilling azaltıldı)
- [x] Backend memory mode token generation fix
- [x] Check-in API JWT token kullanımına göre düzenlendi

**Metrikler:**
| Metric | Öncesi | Sonrası | İyileşme |
|--------|--------|---------|----------|
| Dashboard.tsx Satır | 659 | ~150 | %77 azalma |
| useState Sayısı | 18 | 3 | %83 azalma |
| Prop Drilling | 4 seviye | 1-2 seviye | %75 azalma |

**Test Sonuçları:**
```
✅ Login çalışıyor
✅ Token doğru kaydediliyor
✅ Kafe check-in çalışıyor
✅ Oyun lobisi görünüyor
✅ Mağaza/Envanter sekmeleri çalışıyor
```

---

### ✅ Tamamlanan Fazlar (Devam)

#### Faz 3: UI/UX + Features ✅ (TAMAMLANDI - 2026-02-03)
**Branch:** `feat/phase-3-ui-features` (mevcut)

**Hedefler:**
- [x] Toast Notification Sistemi (4h)
  - ToastContext + useToast hook
  - 4 tip: success, error, warning, loading
  - Auto-dismiss (3s/5s)
  - App.tsx entegrasyonu
  
- [x] Skeleton Loading States (6h)
  - Skeleton.tsx component
  - GameCard, RewardCard, InventoryGrid varyantları
  - GameSection ve RewardSection entegrasyonu
  - `gamesLoading`, `rewardsLoading`, `inventoryLoading` prop'ları
  
- [x] Form Validation (4h)
  - AuthModal: Real-time validation, email regex, şifre göster/gizle, loading states
  - CreateGameModal: Puan input, min/max limitler, preset butonlar, özet panel
  - Toast entegrasyonu ile hata/başarı bildirimleri
  
- [x] Empty States (3h)
  - EmptyState.tsx: Reusable component (default + compact varyantları)
  - GameSection: "Henüz Oyun Yok" durumu
  - RewardSection: Mağaza ve envanter boş durumları
  - İkon, başlık, açıklama ve aksiyon butonları
  
- [ ] Demo Data (3h) - SONRAKİ (Faz 4'te)

**Dosyalar Değişti:**
- `contexts/ToastContext.tsx` - Yeni
- `components/Toast.tsx` - Yeni
- `components/Skeleton.tsx` - Yeni
- `components/EmptyState.tsx` - Yeni
- `components/AuthModal.tsx` - Validation + toast entegrasyonu
- `components/CreateGameModal.tsx` - Validation + puan input
- `components/dashboard/GameSection.tsx` - Loading states + Empty state
- `components/dashboard/RewardSection.tsx` - Loading states + Empty states
- `types.ts` - `isUsed` eklendi
- `backend/server.js` - `is_used` mapping

**Test Sonuçları:**
```
✅ Toast notifications çalışıyor
✅ Skeleton loading görünüyor
✅ Form validation anlık kontrol ediyor
✅ CreateGameModal puan seçimi çalışıyor
✅ Empty states görünüyor (oyun/mağaza/envanter)
```

---

### ✅ Tamamlanan Faz

#### Faz 3: UI/UX + Features ✅ (TAMAMLANDI - 2026-02-03)
**Branch:** `feat/phase-3-ui-features` → merged to main

**Özet:** 4 ana görev tamamlandı (Toast, Skeleton, Form Validation, Empty States)

---

### 🚧 Devam Eden Faz

#### Faz 4: UI/UX Polish & Responsive Design ⏳ (DEVAM EDİYOR)
**Branch:** `feat/phase-4-responsive-ui` (oluşturulacak)

**Hedefler:**

**1. Responsive Layout (8h)**
- [x] Mobile-first breakpoints standardizasyonu
  - sm: 640px, md: 768px, lg: 1024px, xl: 1280px
- [x] Navbar mobile menu (hamburger) - Framer Motion slide-in animasyonlu
- [x] Dashboard grid sistemi - xl:grid-cols-3, mobilde single column
- [x] Tab navigation - Animated indicator, responsive text (mobile: kısaltılmış)
- [x] GameLobby responsive cards - Touch-friendly, animated
- [ ] AuthModal full-screen on mobile
- [ ] Touch-friendly button sizes (min 44x44px) - Partial

**2. Micro-Interactions & Animations (6h)**
- [x] Framer Motion setup - ✅ Kuruldu
- [x] Page transitions - Dashboard tab'ları fade/slide
- [x] Button hover effects - Navbar, Tab'lar scale + glow
- [x] Card hover lift effect - RewardSection: lift + glow + border
- [x] Modal open/close animations - AuthModal: slide up/down
- [x] Toast slide-in/out animations - Stack layout + AnimatePresence
- [ ] Loading spinner enhancements

**Bonus:**
- [x] Inventory coupon shake effect - Retro kupon hissi

**3. Touch & Mobile UX (4h)**
- [ ] Swipe gestures (modal kapatma, tab değiştirme)
- [ ] Pull-to-refresh (dashboard)
- [ ] Bottom sheet for mobile modals
- [ ] Virtual keyboard handling (input focus)

**4. Performance (2h)**
- [ ] Image lazy loading
- [ ] Component lazy loading (code splitting)
- [ ] CSS containment for animations

**Teknik Stack:**
- Tailwind CSS (mevcut)
- Framer Motion (yüklenecek)
- react-use-gesture (swipe için)

#### Faz 5: Database Optimizasyon ⏳ (PLANLANIYOR)
**Branch:** `feat/phase-5-database-optimization` (oluşturulacak)

#### Faz 5: Testing & QA ⏳ (PLANLANIYOR)
**Branch:** `feat/phase-5-testing` (oluşturulacak)

**Hedefler:**
- [ ] Jest + React Testing Library setup
- [ ] Unit test coverage: %70
- [ ] Integration tests (API)
- [ ] E2E tests (Playwright - kritik flow'lar)
- [ ] Test coverage reporting

#### Faz 6: Dokümantasyon ⏳ (PLANLANIYOR)
**Branch:** `feat/phase-6-documentation` (oluşturulacak)

**Hedefler:**
- [ ] OpenAPI/Swagger API dokümantasyonu
- [ ] Architecture Decision Records (ADR)
- [ ] README güncelleme (kurulum, geliştirme)
- [ ] Deployment guide (Docker, production)
- [ ] Contributing guide (open source hazırlık)

**Planlanan Klasör Yapısı:**
```
src/
├── components/
│   └── dashboard/
│       ├── Dashboard.tsx          # Ana container (~100 satır)
│       ├── StatusBar.tsx          # Kullanıcı bilgileri
│       ├── GameSection.tsx        # Oyun lobisi + kurma
│       ├── RewardSection.tsx      # Mağaza + envanter
│       └── TableMatcher.tsx       # Masa kodu doğrulama
├── hooks/
│   ├── useAuth.ts                 # Auth context hook
│   ├── useGames.ts               # Oyun verisi yönetimi
│   ├── useRewards.ts             # Ödül/Envanter yönetimi
│   └── useActiveGame.ts          # Aktif oyun durumu
├── contexts/
│   └── AuthContext.tsx           # Global auth state
```

**Son Yapılan İşlem:**
Faz 1 tamamlandı, Faz 2 planlaması yapıldı. Kullanıcı bağlam koruma sistemini istedi.

---

### 📋 Yapılacak Fazlar (Sıralı)

#### Faz 3: Database Optimizasyon
- Migration sistemi kur (node-pg-migrate)
- Index'ler ekle (performans)
- Enum constraint'leri ekle
- Soft delete standardizasyonu
- Audit trail (updated_at)

#### Faz 4: UI/UX Professional Redesign
- Design system oluştur
- Skeleton loading states
- Toast notifications
- Responsive mobile design
- Micro-interactions (Framer Motion)

#### Faz 5: Testing & QA
- Jest + React Testing Library setup
- Unit test coverage: %70
- Integration tests
- E2E tests (Playwright)

#### Faz 6: Dokümantasyon
- OpenAPI/Swagger API docs
- Architecture Decision Records (ADR)
- README güncelleme
- Deployment guide

---

## 🔧 Teknik Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS v4
- Socket.IO Client
- React Router DOM v7

**Backend:**
- Node.js + Express.js
- Socket.IO
- PostgreSQL (pg)
- JWT (jsonwebtoken)
- bcrypt

**DevOps:**
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Nginx (reverse proxy)

---

## 📝 Önemli Notlar

### Güvenlik (Faz 1'den Kalma)
- Tüm admin endpoint'leri `authenticateToken` + `requireAdmin` ile korunuyor
- Shop endpoint'leri IDOR korumalı
- Race condition'lar PostgreSQL transactions ile çözüldü

### Bilinen Teknik Borçlar
1. `Dashboard.tsx` çok büyük (refactoring gerekli)
2. TypeScript `any` kullanımları var
3. Polling yerine WebSocket'e geçiş gerekebilir
4. Test coverage yok

### Ortam Değişkenleri
`.env` dosyasında olması gerekenler:
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

---

## 🤝 AI Agent İletişim Protokolü

**Bu dosyayı okuyan AI:**
1. Yukarıdaki "Proje Durumu"nu kontrol et
2. Hangi fazda olduğunu anla
3. Yapılacak listesinden sıradaki görevi seç
4. İşlem bitince bu dosyayı GÜNCELLE
5. Kullanıcıya özet sun

**Dosya güncelleme formatı:**
```markdown
### ✅ Tamamlanan [GÖREV_ADI]
**Tarih:** [YYYY-MM-DD]
**Yapılanlar:**
- [x] ...
- [x] ...

**Dosyalar:**
- `path/to/file.ts` - Açıklama
```

---

## 🛠️ Kullanılabilir Araçlar (MCP Servers & Skills)

> **Not:** Bu proje Kimi Code CLI ile geliştiriliyor. 
> Aşağıdaki araçlar mevcutsa KULLANILMALIDIR.

### 1. GitHub MCP Server
**Kullanım alanları:**
- Kod repository'sini okuma
- Branch oluşturma
- Commit & Push işlemleri
- Pull request açma
- Issue takibi

**Örnek kullanımlar:**
```
- Repository içeriğini listele: get_file_contents
- Yeni branch oluştur: create_branch
- Pull request aç: create_pull_request
- Issue oluştur: create_issue
```

### 2. Context7 MCP Server
**Kullanım alanları:**
- Kütüphane dokümantasyonu sorgulama
- Kod örnekleri alma
- API referansları

**Kullanılan kütüphaneler:**
- React, React Router DOM
- Socket.IO
- PostgreSQL (pg)
- Express.js
- Tailwind CSS

**Örnek kullanım:**
```
- React hooks dokümantasyonu: resolve-library-id → query-docs
- Socket.IO best practices: query-docs
```

### 3. Playwright MCP Server
**Kullanım alanları:**
- E2E test kayıtları
- UI test otomasyonu
- Ekran görüntüleri/GIF'ler oluşturma

**Örnek kullanımlar:**
```
- Test kaydı: browser_navigate → browser_snapshot
- Ekran görüntüsü: browser_take_screenshot
```

### 4. Web Search MCP Server
**Kullanım alanları:**
- En iyi pratikleri araştırma
- Hata çözümleri bulma
- Yeni teknolojiler hakkında bilgi

**Örnek kullanım:**
```
- "React 18 best practices 2024"
- "Socket.IO vs WebSocket performance"
```

### 5. Kimi CLI Help Skill
**Yol:** `kimi-cli-help`
**Kullanım:**
- Kimi Code CLI kullanımı hakkında sorular
- Konfigürasyon yardımı
- MCP entegrasyonu

---

## 📋 AI Agent Checklist

Her session başında:
- [ ] AGENTS.md okundu
- [ ] CONTEXT.md okundu
- [ ] Mevcut faz anlaşıldı
- [ ] Kullanılabilir MCP server'lar kontrol edildi
- [ ] Git durumu kontrol edildi (`git status`)

Her session sonunda:
- [ ] CONTEXT.md güncellendi
- [ ] AGENTS.md güncellendi (eğer faz değiştiysen)
- [ ] Değişiklikler commit edildi
- [ ] Kullanıcıya özet verildi

---

## 🆘 Acil Durumlar

Eğer proje çalışmazsa kontrol edilecekler:
1. `npm install` yapıldı mı?
2. `.env` dosyası var mı?
3. PostgreSQL çalışıyor mu? (veya memory fallback modunda mı?)
4. Backend: `localhost:3001`
5. Frontend: `localhost:3000`

---

## 📞 Bağlam Soruları

AI'e proje hakkında soru sorulacaksa:
- "AGENTS.md'deki mevcut faz nedir?"
- "Dashboard.tsx neden refactoring gerektiriyor?"
- "Faz 1'de hangi güvenlik önlemleri alındı?"

Bu dosya otomatik olarak senkronize tutulmalıdır.
