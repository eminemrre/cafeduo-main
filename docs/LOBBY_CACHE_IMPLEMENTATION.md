# Lobby Cache Implementation

## Overview
Redis tabanlı lobby cache katmanı, waiting games listelerini cache'leyerek DB yükünü azaltır ve lobby performansını artırır.

## Architecture

### Cache Strategy
- **Pattern**: Cache-aside
- **TTL**: 5 saniye (stale data riskini minimize)
- **Invalidation**: Write-through (oyun değiştiğinde anında cache temizle)
- **Fallback**: Graceful (Redis yoksa DB'ye düşer)

### Cache Keys
```
lobby:all           -> Tüm waiting games
lobby:table:{code}  -> Masa bazlı games (örn: lobby:table:masa01)
lobby:cafe:{id}     -> Kafe bazlı games (örn: lobby:cafe:5)
```

## Files Modified

### 1. New File: `backend/services/lobbyCacheService.js`
Lobby cache service factory:
- `getWaitingGames()` - Cache'ten veya DB'den oyunları getir
- `onGameCreated()` - Oyun oluşturulduğunda cache'i temizle
- `onGameJoined()` - Oyuna katılınca cache'i temizle
- `onGameDeleted()` - Oyun silinince cache'i temizle
- `onGameFinished()` - Oyun bitince cache'i temizle
- `clearAllCache()` - Manuel cache temizleme (admin için)
- `getCacheStats()` - Cache istatistikleri (monitoring için)

### 2. Modified: `backend/services/gameService.js`
- `lobbyCacheService` parametresi eklendi
- `listWaitingGames()` fonksiyonu cache layer ile güncellendi

### 3. Modified: `backend/handlers/gameHandlers.js`
- `lobbyCacheService` parametresi eklendi
- `createGame()` - Cache invalidation eklendi
- `joinGame()` - Cache invalidation eklendi
- `deleteGame()` - Cache invalidation eklendi

### 4. Modified: `backend/server.js`
- `redisClient` import eklendi
- `lobbyCacheService` initialization eklendi
- `gameService` ve `gameHandlers`'a cache service enjekte edildi

## Performance Impact

### Before
- Her lobby isteği DB sorgusu
- Yüksek trafikte DB bottleneck
- P95 latency: ~100-200ms

### After (Expected)
- Cache hit: ~1-5ms (Redis)
- Cache miss: ~100-200ms (DB + cache write)
- Yüksek trafikte 90%+ cache hit oranı bekleniyor
- P95 latency: ~10-20ms

## Monitoring

### Cache Hit Rate
```javascript
const stats = await lobbyCacheService.getCacheStats();
console.log(`Cache keys: ${stats.keyCount}`);
```

### Logs
```
[DEBUG] Lobby cache hit: lobby:all
[DEBUG] Lobby cache miss: lobby:table:masa01, fetching from DB
[DEBUG] Invalidated lobby cache: lobby:all, lobby:table:masa01
```

## Configuration

### Environment Variables
```bash
# .env
REDIS_URL=redis://localhost:6379
```

### TTL Ayarı
`backend/services/lobbyCacheService.js`:
```javascript
const CACHE_TTL_SECONDS = 5; // İhtiyaca göre ayarlayın
```

## Testing

### Manual Test
```bash
# 1. Redis'i başlat
docker-compose up -d redis

# 2. Server'ı başlat
npm start

# 3. Lobby endpoint'ine istek at
curl http://localhost:3001/api/games

# 4. Redis'te cache key'lerini kontrol et
redis-cli
> KEYS lobby:*
> GET lobby:all
> TTL lobby:all
```

### Load Test
```bash
# Apache Bench ile lobby endpoint test
ab -n 1000 -c 10 http://localhost:3001/api/games
```

## Troubleshooting

### Cache Temizleme
```javascript
// Admin endpoint eklenebilir
await lobbyCacheService.clearAllCache();
```

### Redis Bağlantı Sorunu
```
⚠️  Redis disabled: REDIS_URL is not configured. Falling back to in-memory mode.
```
→ `.env` dosyasında `REDIS_URL` tanımlayın.

### Cache Invalidation Çalışmıyor
```
[WARN] Cache invalidation failed on game created: ...
```
→ Redis bağlantısını kontrol edin.

## Future Improvements

1. **Cache Warming**: Server başladığında cache'i önceden doldur
2. **Multi-level Cache**: Memory + Redis katmanı
3. **Pub/Sub**: Cache invalidation için Redis pub/sub
4. **Metrics**: Prometheus/Grafana entegrasyonu
5. **Dynamic TTL**: Yük durumuna göre TTL ayarı
