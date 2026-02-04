# ADR-005: Role-Based Access Control

## Status
Accepted

## Context: Farklı yetki seviyeleri (admin, cafe_admin, user)

## Decision
3-tier RBAC: `admin`, `cafe_admin`, `user`

### Middleware'ler
- `authenticateToken` - JWT doğrulama
- `requireAdmin` - Admin yetkisi
- `requireCafeAdmin` - Kafe yöneticisi
- `requireOwnership` - Kaynak sahibi

## Consequences
- Clean authorization logic
- Reusable middleware
- IDOR attack prevention

## Alternatives
- Attribute-based (ABAC) - Overkill
- Access Control Lists (ACL) - Too granular
