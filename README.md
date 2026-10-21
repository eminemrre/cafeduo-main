# CafeDuo

CafeDuo, üniversite kafelerinde müşteri sadakatini oyunlaştıran bir web platformu. Kullanıcılar GPS ve masa PIN'i ile kafeye check-in yapar, iki kişilik gerçek zamanlı oyunlar oynayıp puan kazanır ve puanları kafenin ödüllerine dönüştürür. Kafe yöneticileri kendi konumlarını, PIN'lerini, ödüllerini ve günlük çark içeriğini yönetir.

[![CI](https://github.com/eminemrre/cafeduo-main/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/eminemrre/cafeduo-main/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Canlı ortam: [cafeduotr.com](https://cafeduotr.com) · API dokümanı: [cafeduotr.com/api-docs](https://cafeduotr.com/api-docs)

## Mimari

Tek paketli bir Node + React uygulaması:

- **Frontend** — `components/`, `hooks/`, `lib/`: React, TypeScript, Vite ve Tailwind. Rotalar `lazyWithRetry()` ile tembel yüklenir; PWA servis çalışanı üretim derlemesinde üretilir.
- **Backend** — `backend/`: CommonJS Express API. İstekler `routes/` → controller/handler → servis katmanından geçer; kimlik doğrulama `authenticateToken`, CSRF ve Redis destekli rate limit middleware'leriyle yapılır.
- **Realtime** — Socket.IO. İstemci JWT'yi `socket.auth.token` ile gönderir; lobi ve oyun durumu `lobby_updated`, `game_state_updated` gibi olaylarla yayınlanır.
- **Veritabanı** — PostgreSQL (`pg`). Şema değişiklikleri yalnızca `migrations/` altında `node-pg-migrate` ile yapılır; veritabanı yoksa uygulama bellek modunda çalışır.
- **Cache** — Redis. Lobi cache'i, rate limit sayaçları ve JWT kara listesi burada tutulur; Socket.IO ölçeklendirmesinde de kullanılır.
- **Ortak kod** — `shared/gameRegistry.js` oyun tanımlarını iki tarafa da verir; `openapi.yaml` HTTP sözleşmesini tanımlar ve `/api-docs` üzerinden yayınlanır.

## Gereksinimler

- Node.js `>=20.17.0` ve npm `>=10.0.0` (`package.json` → `engines`)
- PostgreSQL ve Redis; yerelde Docker Compose ile ayağa kaldırılabilir

## Kurulum

```bash
git clone https://github.com/eminemrre/cafeduo-main.git
cd cafeduo-main
npm ci
cp .env.example .env
docker compose up -d db redis
npm run migrate:up
npm run dev
```

`.env` içinde en az `JWT_SECRET`, `DATABASE_URL` ve `REDIS_URL` değerlerini doldurun. Üretimde `JWT_SECRET` en az 64 karakter olmalıdır:

```bash
openssl rand -hex 64
```

`npm run dev` API'yi ve Vite geliştirme sunucusunu birlikte başlatır.

| Servis          | URL                              |
| --------------- | -------------------------------- |
| Frontend (Vite) | http://localhost:3000            |
| API             | http://localhost:3001            |
| Swagger         | http://localhost:3001/api-docs   |
| Sağlık kontrolü | http://localhost:3001/api/health |

Tüm sistemi konteynerde çalıştırmak için `docker compose up -d`; üretim benzeri kurulum için `deploy/docker-compose.dokploy.yml` kullanılır.

## Komutlar

| Komut                         | Ne yapar                                              |
| ----------------------------- | ----------------------------------------------------- |
| `npm run dev`                 | API ve Vite'ı birlikte, değişiklik izleyerek başlatır |
| `npm start`                   | API'yi üretim modunda çalıştırır                      |
| `npm run build`               | Vite üretim derlemesini `dist/` altına yazar          |
| `npm run quality`             | ESLint + TypeScript tip kontrolü                      |
| `npm test`                    | Jest birim ve entegrasyon testleri                    |
| `npm run test:ci`             | Jest'i CI modunda, coverage raporuyla çalıştırır      |
| `npm run test:e2e:smoke`      | Playwright `@smoke` senaryoları (Chromium)            |
| `npm run test:e2e:advanced`   | Playwright `@advanced` senaryoları                    |
| `npm run migrate:create <ad>` | Yeni migration dosyası oluşturur                      |
| `npm run migrate:up`          | Bekleyen migration'ları uygular                       |
| `npm run migrate:down`        | Son migration'ı geri alır                             |
| `npm run migrate:status`      | Migration durumunu gösterir                           |
| `npm run verify`              | Audit, lint, tip kontrolü, test ve build zinciri      |
| `npm run smoke:live`          | Canlı ortama karşı health smoke kontrolü              |

Şema değişikliklerini test ederken ileri-geri-ileri akışını çalıştırın:

```bash
npm run migrate:up && npm run migrate:down && npm run migrate:up
```

## Test

```bash
npm test
npm run test:ci
npm run test:e2e:smoke
```

Playwright smoke testleri uygulamayı kendi başlatır; ayrı bir sunucu açmanız gerekmez. `@advanced` senaryoları gecelik iş akışında çalışır.

## Dağıtım

`main` dalına yapılan her merge Dokploy tarafından otomatik olarak çekilir ve `deploy/docker-compose.dokploy.yml` ile dağıtılır. Doğrudan `main`'e push etmeyin; değişiklikler pull request ile gelir.

Dağıtım sonrası kontrol:

```bash
curl https://cafeduotr.com/api/health
curl https://cafeduotr.com/api/readiness
```

Ortam değişkenleri, Dokploy ayarları ve geri alma adımları için [DEPLOYMENT.md](DEPLOYMENT.md) dosyasına bakın.

## Katkı ve lisans

- Katkı kuralları: [CONTRIBUTING.md](CONTRIBUTING.md)
- Davranış kuralları: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Güvenlik bildirimi: [SECURITY.md](SECURITY.md)
- Lisans: [MIT](LICENSE)
