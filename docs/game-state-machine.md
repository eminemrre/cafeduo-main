# Game State Machine Contract

Son guncelleme: 2026-02-10
Kapsam: CafeDuo PvP oyun akisi

## Durumlar

- `waiting`: Oyun olusturuldu, ikinci oyuncu bekleniyor.
- `active`: Oyun basladi, hamle/ilerleme aliyor.
- `finishing`: Sonuc kapatma asamasi (ileride asenkron finalize icin ayrildi).
- `finished`: Oyun sonuclandi, winner/draw net.

## Gecerli gecisler

| From | To | Neden |
|---|---|---|
| `waiting` | `active` | Oyuncu oyuna katildi |
| `waiting` | `finished` | Zorunlu kapanis / timeout / admin finalizasyonu |
| `active` | `active` | Oyun devam ediyor (hamle) |
| `active` | `finishing` | Sonuc hesaplama baslangici (opsiyonel) |
| `active` | `finished` | Son hamle/sonuc olustu |
| `finishing` | `finished` | Finalizasyon tamamlandi |
| `finished` | `finished` | Idempotent tekrar cagri |

## Gecersiz gecisler

Asagidaki ornekler API tarafinda `409` ile reddedilir:

- `waiting -> finishing`
- `finished -> active`
- Bilinmeyen status degerleri (or. `paused`)

Hata sekli:

```json
{
  "error": "Gecersiz oyun durumu gecisi (...)",
  "code": "invalid_status_transition",
  "fromStatus": "waiting",
  "toStatus": "finishing"
}
```

## Uygulama noktasi

- `POST /api/games/:id/join`:
  - `waiting -> active` disi gecisler engellenir.
- `POST /api/games/:id/move`:
  - Satranc ve durum degistiren akislarda `active -> active|finished` guard uygulanir.
- `POST /api/games/:id/finish`:
  - `finished` idempotent kabul edilir.
  - Diger gecersiz finalizasyonlar engellenir.

## Notlar

- Mevcut sistemde `finishing` statusu runtime'da zorunlu degil; ileri fazlarda asenkron finalize pipeline'i icin ayrilmistir.
- `status` tek dogruluk kaynagi olarak server tarafinda yonetilir.
