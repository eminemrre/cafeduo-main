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

### 🚧 Devam Eden Faz

#### Faz 2: Frontend Refactoring 🔄 (BAŞLANDI)
**Branch:** `feat/phase-1-security-hardening` üzerinde devam edilecek
**Sonraki branch:** `feat/phase-2-frontend-refactoring`

**Hedefler:**
- [ ] Dashboard.tsx'i 659 satırdan ~100 satıra indir
- [ ] 18 useState'i 2-3'e indir
- [ ] Custom hooks oluştur (useGames, useRewards, useActiveGame)
- [ ] Component extraction (GameSection, RewardSection, StatusBar)
- [ ] Auth Context implementasyonu (prop drilling'i azalt)
- [ ] Type safety iyileştirmeleri (any kaldır)

**Mevcut Sorunlar:**
- `Dashboard.tsx` 659 satır - God Component anti-pattern
- 18 adet useState tek component'te
- Prop drilling derinliği: 4 seviye
- TypeScript `any` kullanımı mevcut
- Tekrar eden API çağrıları

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
***REMOVED***=postgres://...
***REMOVED***=your-secret-key
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
