# Performance Indexes (Sprint 5)

Bu güncelleme oyun/lobi sorgularında en çok kullanılan filtreleri indeksledi:

- `games(status, created_at DESC)`
- `games(status, table_code, created_at DESC)`
- `games(status, game_type, created_at DESC)`
- `games(status, host_name, created_at DESC)`
- `games(status, guest_name, created_at DESC)`
- `games(host_name, created_at DESC)`
- `games(guest_name, created_at DESC)`
- `users((LOWER(username)), cafe_id)`
- `users(cafe_id, table_number)`
- `user_items(user_id, is_used)`

## Neden

- Lobi listesi: `status='waiting' + order by created_at`
- Masa bazlı lobi: `status + table_code`
- Oyun türü filtreleme: `status + game_type`
- Aktif oyun/çakışma kontrolü: `status + host_name/guest_name`
- Kafe scope lobi sorgusu: `LOWER(users.username) + cafe_id`

## Uygulama Noktaları

- Runtime bootstrap: `backend/server.js` içinde `initDb()`
- Kurulum şeması: `schema.sql`

## Hızlı Doğrulama

```sql
EXPLAIN ANALYZE
SELECT id, host_name, game_type, points, table_code, status, guest_name, created_at
FROM games
WHERE status = 'waiting'
ORDER BY created_at DESC
LIMIT 50;
```

```sql
EXPLAIN ANALYZE
SELECT id
FROM games
WHERE (host_name = 'eminemre' OR guest_name = 'eminemre')
  AND status IN ('waiting','active')
ORDER BY created_at DESC
LIMIT 1;
```
