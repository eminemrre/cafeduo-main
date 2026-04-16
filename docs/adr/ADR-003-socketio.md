# ADR-003: Socket.IO for Real-time Games

## Status
Accepted

## Context
Anlık oyun durumu senkronizasyonu gerekiyordu (Refleks Avı, Ritim Kopyala, Çift Tek Sprint).

## Decision
**Socket.IO** kullanıldı.

### Nedenleri
- WebSocket fallback (HTTP long-polling)
- Room-based broadcast
- Event-driven architecture
- Client library zenginliği

## Consequences
- Real-time multiplayer mümkün
- Server memory'de game state (Map)
- Redis persistence planlanıyor

## Alternatives
- Raw WebSocket - Rejected (fallback gerekli)
- Server-Sent Events - Rejected (bidirectional gerekli)
