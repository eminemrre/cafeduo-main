# System Heartbeat

> **Status:** Stable (P0 + P1 complete, production deploy baseline added)

## Vital Signs
- **Backend Security**: JWT fallback secret removed; `JWT_SECRET` startup zorunlu.
- **AuthZ Hardening**: Rewards/coupon admin endpointleri yetkilendirme ile korumali.
- **Data Integrity**: `/api/shop/buy` sadece `rewardId` ile DB tabanli dogrulama yapiyor.
- **Game UX Refresh**: 3 hizli oyun aktif:
  - `Refleks Avı`
  - `Ritim Kopyala`
  - `Çift Tek Sprint`
- **Backward Compatibility**: Dashboard/Lobi eski oyun adlarini da taniyor.
- **Build**: `npm run build` passed on 2026-02-05.
- **Tests**: `npm run test:ci` passed on 2026-02-06 (`261/261`).
- **Coverage**: Global lines `%75.79`; oyun modulu + cafe paneli + socket `%85+`.
- **Deploy Baseline**: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy-vps.yml` hazir (VDS only).

## Next Checkup
- Hedef: Global coverage `%85`.
- Odak: `%85` icin landing + utility bileşenlerinin testlenmesi (`Hero`, `HowItWorks`, `Games`, `Footer`, `Skeleton`, `EmptyState`).
