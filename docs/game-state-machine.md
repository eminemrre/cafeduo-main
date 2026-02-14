# Game State Machine Contract

Son güncelleme: 2026-02-14  
Kapsam: CafeDuo PvP oyun akışı

## Durumlar

- `waiting`: Oyun oluşturuldu, ikinci oyuncu bekleniyor.
- `active`: Oyun başladı, hamle/ilerleme kabul ediliyor.
- `finishing`: Sonuç kapatma aşaması (asenkron finalize için ayrılmış ara durum).
- `finished`: Oyun sonuçlandı, kazanan/beraberlik kesinleşti.

## Geçerli Geçişler

| From | To | Neden |
|---|---|---|
| `waiting` | `active` | Oyuncu oyuna katıldı |
| `waiting` | `finished` | Zorunlu kapanış / admin kapanışı |
| `active` | `active` | Oyun devam ediyor (hamle) |
| `active` | `finishing` | Sonuç hesaplama başlangıcı (opsiyonel) |
| `active` | `finished` | Timeout, teslim olma, mat, beraberlik, finalizasyon |
| `finishing` | `finished` | Finalizasyon tamamlandı |
| `finished` | `finished` | Idempotent tekrar çağrı |

## Geçersiz Geçişler

Aşağıdaki örnekler API tarafında tutarlı `4xx` (çoğunlukla `409`) döner:

- `waiting -> finishing`
- `finished -> active`
- Bilinmeyen status değerleri (örn. `paused`)
- `active` dışında hamle/score/live/game_state güncelleme denemeleri

Hata şekli:

```json
{
  "error": "Geçersiz oyun durumu geçişi (...)",
  "code": "invalid_status_transition",
  "fromStatus": "waiting",
  "toStatus": "active"
}
```

## Rejoin Sözleşmesi

- `waiting`:
  - Host oyun lobisinde kalır.
  - Başka oyuncu `join` ile oyunu `active` yapar.
- `active`:
  - Host/guest aynı kullanıcıyla tekrar `join` çağırırsa idempotent olarak oyuna döner.
  - Üçüncü oyuncu `409` alır.
- `finishing`:
  - Yeni katılım ve hamle kapalıdır, yalnızca sonuçlanma beklenir.
- `finished`:
  - `join` ile yeniden aktive edilemez (`invalid_status_transition`).
  - Oyun durumu sadece okuma amaçlı alınır.

## Uygulama Noktaları

- `POST /api/games/:id/join`:
  - `waiting -> active` geçişini uygular.
  - `finished -> active` gibi geçişleri engeller.
- `POST /api/games/:id/move`:
  - Satranç/live/score/legacy hamleleri için aktif oyun şartı zorunludur.
- `POST /api/games/:id/finish`:
  - `finished` idempotent kabul edilir.
  - Geçersiz finalizasyonlar engellenir.

## Notlar

- `status` server-authoritative tek doğruluk kaynağıdır.
- `finishing` mevcut sürümde opsiyonel ara durumdur; ileri sprintlerde finalize pipeline için kullanılacaktır.
