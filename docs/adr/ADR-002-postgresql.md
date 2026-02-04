# ADR-002: PostgreSQL over NoSQL

## Status
Accepted

## Context
Veritabanı seçimi: ilişkisel vs doküman tabanlı.

## Decision
**PostgreSQL** seçildi.

### Nedenleri
- Complex relationships (users-games-cafes-rewards)
- ACID transactions (race condition önleme)
- JSONB desteği (esneklik)
- Mevcut know-how

## Consequences
- JOIN'lerle verimli sorgular
- Migration sistemi kuruldu
- Soft delete pattern

## Alternatives
- MongoDB - Rejected (relationship complexity)
- SQLite - Development only
