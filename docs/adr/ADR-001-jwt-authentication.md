# ADR-001: JWT Authentication

## Status
Accepted

## Context
CafeDuo uygulamasında kullanıcı kimlik doğrulama mekanizması seçimi yapılması gerekiyordu. Stateless bir mimari ve horizontal scaling ihtiyacı vardı.

## Decision
**jsonwebtoken** kütüphanesi ile JWT tabanlı stateless authentication.

### Teknik Detaylar
- Token payload: `{ userId, email, role }`
- Signing: HS256
- Expiry: 7 gün
- Storage: localStorage (geçici, httpOnly cookie'ye geçiş planlanıyor)

## Consequences

### Positive
- Stateless, horizontal scaling kolay
- Cross-domain uyumlu
- Mobile-ready
- Self-contained

### Negative
- No instant revoke (blacklist yok)
- localStorage XSS riski

## Alternatives Considered
- Session-based (Redis) - Rejected (scaling complexity)
- OAuth2 - Future consideration
