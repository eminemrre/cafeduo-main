# 💡 Shared Insights & Cross-Agent Comms

> Use this file to log architectural decisions, API changes, or design tokens that affect multiple domains.

## 📡 Backend -> Frontend
- **Redis Integration**: We are adding Redis. This might cause a brief downtime in Socket.IO connections during deployment.
- **API Latency**: We aim to reduce game creation time from ~200ms to <50ms.

## 🎨 Frontend -> Backend
- (Waiting for inputs...)

## 🛡️ Architect Notes
- Keep `schema.sql` synchronized with any migration.
- Ensure `types.ts` is updated if API response structure changes for performance reasons.
