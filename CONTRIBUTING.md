# 🤝 Contributing to CafeDuo

> **Hoş geldiniz!** CafeDuo'ya katkıda bulunmak istediğiniz için teşekkür ederiz.

## 📋 İçindekiler

- [Proje Hakkında](#proje-hakkında)
- [Nasıl Katkıda Bulunabilirim?](#nasıl-katkıda-bulunabilirim)
- [Development Setup](#development-setup)
- [Branch Stratejisi](#branch-stratejisi)
- [Commit Convention](#commit-convention)
- [Pull Request Süreci](#pull-request-süreci)
- [Code Style](#code-style)
- [Testing](#testing)
- [Issue Bildirimi](#issue-bildirimi)

---

## Proje Hakkında

**CafeDuo**, oyunlaştırılmış bir kafe sadakat platformudur. Öğrenciler kafede check-in yaparak birbirleriyle oyun oynar, puan kazanır ve ödüller alır.

### Teknoloji Stack'i

| Katman | Teknolojiler |
|--------|--------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + Express.js + Socket.IO |
| **Veritabanı** | PostgreSQL |
| **Auth** | JWT + Google OAuth |
| **Test** | Jest + React Testing Library + Playwright |

---

## Nasıl Katkıda Bulunabilirim?

### 🐛 Bug Bildirme

Bir hata bulduysanız, lütfen [GitHub Issues](https://github.com/kiliczsh/cafeduo/issues) üzerinden bildirin. Issue açmadan önce:

1. Mevcut issue'ları kontrol edin (duplicate olmadığından emin olun)
2. Bug report template'ini kullanın
3. Hatayı tekrarlamak için adımları detaylı yazın
4. Mümkünse ekran görüntüsü veya video ekleyin

### 💡 Yeni Özellik Önerme

Yeni bir özellik fikriniz varsa:

1. Önce bir issue açarak fikrinizi tartışın
2. Feature request template'ini kullanın
3. Topluluktan geri bildirim alın
4. Kabul edilirse PR açabilirsiniz

### 🔧 Kod Katkısı

1. Repoyu fork edin
2. Feature branch oluşturun (`git checkout -b feat/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feat/amazing-feature`)
5. Pull Request açın

---

## Development Setup

### Gereksinimler

- **Node.js**: v18+ (LTS önerilir)
- **PostgreSQL**: v14+
- **Git**

### Kurulum Adımları

```bash
# 1. Repo'yu klonlayın
git clone https://github.com/kiliczsh/cafeduo.git
cd cafeduo

# 2. Bağımlılıkları yükleyin
npm install

# 3. Çevre değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasını düzenleyin

# 4. Veritabanını başlatın (Docker ile)
docker-compose up db -d

# VEYA manuel olarak PostgreSQL oluşturun:
# createdb cafeduo
# psql cafeduo < schema.sql

# 5. Uygulamayı başlatın
npm run dev
```

### Mevcut Scriptler

| Script | Açıklama |
|--------|----------|
| `npm run dev` | Hem frontend (3000) hem backend (3001) başlatır |
| `npm run server` | Sadece backend'i başlatır (nodemon ile) |
| `npm run client` | Sadece frontend'i başlatır |
| `npm run build` | Production build alır |
| `npm test` | Unit testleri çalıştırır |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |
| `npm run test:coverage` | Coverage raporu ile testleri çalıştırır |
| `npm run test:e2e` | Playwright E2E testlerini çalıştırır |
| `npm run test:all` | Hem unit hem E2E testleri çalıştırır |

### Çevre Değişkenleri (`.env`)

```bash
# Temel
NODE_ENV=development
PORT=3001

# Veritabanı
***REMOVED***=postgres://username:password@localhost:5432/cafeduo

# JWT
***REMOVED***=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Opsiyonel: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
***REMOVED***=your-google-client-secret
```

---

## Branch Stratejisi

```
main
  │
  ├── develop (integration branch)
  │     │
  │     ├── feat/user-authentication
  │     ├── feat/payment-integration
  │     └── fix/login-redirect-bug
  │
  └── hotfix/critical-security-patch
```

### Branch Tipleri

| Prefix | Açıklama | Örnek |
|--------|----------|-------|
| `main` | Production kodu | Direkt push yasak |
| `develop` | Entegrasyon branch'i | Feature'lar burada birleşir |
| `feat/*` | Yeni özellikler | `feat/game-lobby-redesign` |
| `fix/*` | Hata düzeltmeleri | `fix/memory-leak` |
| `hotfix/*` | Kritik prod düzeltmeleri | `hotfix/security-patch` |
| `docs/*` | Dokümantasyon | `docs/api-examples` |
| `test/*` | Test eklemeleri | `test/e2e-checkout` |
| `refactor/*` | Kod refactor | `refactor/split-dashboard` |
| `chore/*` | Build/config değişiklikleri | `chore/update-deps` |

### Naming Convention

```bash
# ✅ İyi
feat/add-game-lobby
fix/login-redirect-on-mobile
docs/contributing-guide
test/unit-auth-hooks

# ❌ Kötü
feature
bugfix
my-branch
new-stuff
```

---

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) kullanıyoruz.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Commit Tipleri

| Tip | Açıklama | Örnek |
|-----|----------|-------|
| `feat` | Yeni özellik | `feat: add game lobby component` |
| `fix` | Hata düzeltmesi | `fix: resolve socket connection leak` |
| `docs` | Dokümantasyon | `docs: update API endpoints` |
| `test` | Test ekleme/düzeltme | `test: add auth hook tests` |
| `refactor` | Kod refactor | `refactor: extract useGames hook` |
| `chore` | Build/config | `chore: update eslint rules` |
| `perf` | Performans | `perf: optimize database queries` |
| `style` | Kod stili (formatting) | `style: fix indentation` |

### Örnek Commitler

```bash
# Basit özellik
feat: add toast notification system

# Scope ile
docs(readme): add installation instructions

# Body ile
feat(auth): add Google OAuth integration

- Add Google login button
- Handle OAuth callback
- Store tokens securely

Closes #123

# Breaking change
feat(api): change response format

BREAKING CHANGE: response now returns { data, meta } instead of direct data
```

### Commit Best Practices

```bash
# ✅ İyi commit mesajları
feat: add skeleton loading states
docs: update API documentation with examples
test: add unit tests for useRewards hook
refactor: split Dashboard into smaller components

# ❌ Kötü commit mesajları
güncelleme
fix
deneme
wip
```

---

## Pull Request Süreci

### 1. Branch Oluşturma

```bash
# Develop branch'inden başlayın
git checkout develop
git pull origin develop

# Yeni feature branch oluşturun
git checkout -b feat/yeni-ozellik
```

### 2. Geliştirme

- Kod yazın
- Test yazın
- Commit'leri atın
- Lokalde test edin

```bash
# Testleri çalıştırın
npm test
npm run test:e2e

# Build alın
npm run build
```

### 3. Push ve PR Açma

```bash
# Branch'i push edin
git push origin feat/yeni-ozellik

# GitHub'da PR açın (veya CLI ile)
gh pr create --base develop --title "feat: yeni özellik"
```

### 4. PR Template

PR açarken template'i doldurun:

```markdown
## 📋 Açıklama
Bu PR ne yapıyor?

## 🔗 İlişkili Issue
Closes #123

## 🔄 Değişiklikler
- [x] Yeni özellik eklendi
- [ ] Dokümantasyon güncellendi
- [x] Testler eklendi

## 🧪 Test
- [x] Unit testler geçiyor
- [x] E2E testler geçiyor
- [x] Manuel test yapıldı

## 📸 Ekran Görüntüleri
[gerekirse]
```

### 5. Review Süreci

```
┌─────────────────────────────────────┐
│  PR Açıldı                          │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  CI/CD Çalışır                      │
│  - Unit Tests ✅                    │
│  - E2E Tests ✅                     │
│  - Build ✅                         │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Code Review                        │
│  - En az 1 approval                 │
│  - Yorumlar çözümlenir              │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Merge to develop                   │
└─────────────────────────────────────┘
```

### 6. Merge Kuralları

- ✅ CI/CD geçmeli (tüm testler)
- ✅ En az 1 review approval
- ✅ Conflicts çözülmeli
- ✅ Branch up-to-date olmalı

---

## Code Style

### ESLint Kuralları

Proje ESLint kurallarını otomatik uygular. IDE'nizde ESLint eklentisi kurulu olduğundan emin olun.

```bash
# Manuel kontrol
npx eslint . --ext .ts,.tsx,.js

# Otomatik düzeltme
npx eslint . --ext .ts,.tsx,.js --fix
```

### Prettier Format

```bash
# Tüm dosyaları formatla
npx prettier --write .

# Kontrol et (CI için)
npx prettier --check .
```

### TypeScript Kuralları

- **Strict mode** aktif
- `any` kullanımından kaçının
- Tüm fonksiyonlara return type ekleyin
- Interface'leri `types.ts` dosyalarında tanımlayın

```typescript
// ✅ İyi
interface User {
  id: number;
  email: string;
  role: 'admin' | 'user';
}

function getUserById(id: number): Promise<User | null> {
  // ...
}

// ❌ Kötü
function getUser(id) {
  // ...
}
```

### Kod Stili İlkeleri

| İlke | Açıklama |
|------|----------|
| **Anlamlı isimler** | `getUser` > `getU`, `handleClick` > `handle` |
| **JSDoc yorumları** | Public fonksiyonlara dokümantasyon |
| **Küçük fonksiyonlar** | Tek sorumluluk, max 50 satır |
| **Async/await** | Callback yerine kullanın |
| **Error handling** | Graceful error handling |

### Örnek: JSDoc

```typescript
/**
 * Kullanıcıyı ID'ye göre getirir
 * @param id - Kullanıcı ID'si
 * @returns Kullanıcı objesi veya null
 * @throws DatabaseError - Veritabanı hatası durumunda
 */
async function getUserById(id: number): Promise<User | null> {
  // implementation
}
```

---

## Testing

### Test Stratejisi

```
┌────────────────────────────────────────────┐
│              E2E Tests                     │  ← Playwright
│         (Kullanıcı senaryoları)            │     ~10 test
├────────────────────────────────────────────┤
│           Integration Tests                │  ← React Testing Library
│        (Component interactions)            │     ~30 test
├────────────────────────────────────────────┤
│             Unit Tests                     │  ← Jest
│         (Hooks, Utilities)                 │     ~70 test
└────────────────────────────────────────────┘
```

### Test Komutları

```bash
# Unit testler (Jest)
npm test

# İzleme modu
npm run test:watch

# Coverage raporu
npm run test:coverage

# E2E testler (Playwright)
npm run test:e2e

# E2E UI modu
npm run test:e2e:ui

# Tüm testler
npm run test:all
```

### Coverage Hedefleri

| Kategori | Hedef |
|----------|-------|
| Statements | %70+ |
| Branches | %60+ |
| Functions | %70+ |
| Lines | %70+ |

### Test Yazım İlkeleri

```typescript
// ✅ İyi test
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('RetroButton', () => {
  it('renders button with text', () => {
    render(<RetroButton>Başla</RetroButton>);
    expect(screen.getByText('Başla')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    render(<RetroButton onClick={handleClick}>Tıkla</RetroButton>);
    
    await userEvent.click(screen.getByText('Tıkla'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Mock Kullanımı

```typescript
// Socket.IO mock'u
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// localStorage mock'u
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  writable: true,
});
```

---

## Issue Bildirimi

### Bug Report Template

```markdown
## 🐛 Bug Açıklaması
Kısa ve net bir açıklama.

## 🔄 Tekrarlatma Adımları
1. Adım 1
2. Adım 2
3. Adım 3

## ✅ Beklenen Davranış
Ne olmasını bekliyordunuz?

## ❌ Gerçekleşen Davranış
Ne oldu?

## 📸 Ekran Görüntüsü
Varsa ekleyin.

## 🌍 Ortam
- OS: [örn. Windows 11, macOS 14]
- Browser: [örn. Chrome 120]
- Version: [örn. 1.0.0]
```

### Feature Request Template

```markdown
## 💡 Özellik Açıklaması
Bu özellik ne yapmalı?

## 🤔 Neden Gerekli?
Bu özellik neden faydalı?

## 📝 Önerilen Çözüm
Nasıl implement edilebilir?

## 🔄 Alternatifler
Düşünülen diğer çözümler?

## 📸 Mockup/Screenshot
Varsa ekleyin.
```

### Issue Label'ları

| Label | Açıklama |
|-------|----------|
| `bug` | Hata bildirimi |
| `enhancement` | Yeni özellik |
| `documentation` | Dokümantasyon |
| `good first issue` | Yeni başlayanlar için |
| `help wanted` | Yardım bekleniyor |
| `priority/high` | Yüksek öncelik |

---

## 📞 Yardım

Sorularınız mı var?

- 💬 **GitHub Discussions**: Genel tartışmalar
- 🐛 **GitHub Issues**: Bug report ve feature request
- 📧 **Email**: [contact@cafeduo.app](mailto:contact@cafeduo.app)

---

## 🙏 Teşekkürler

Katkınız için teşekkür ederiz! Her katkı, CafeDuo'yu daha iyi yapıyor. 🎉

---

<div align="center">

**[⬆ Back to Top](#-contributing-to-cafeduo)**

Made with ❤️ by CafeDuo Team

</div>
