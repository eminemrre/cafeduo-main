# CafeDuo PWA (Progressive Web App) Setup

Bu doküman CafeDuo'nun PWA özelliklerini açıklar.

## Özellikler

- **Offline Mode**: İnternet bağlantısı olmadan önbelleğe alınmış içeriklere erişim
- **Installable**: Ana ekrana eklenebilir native app deneyimi
- **Auto-Update**: Service worker otomatik güncelleme
- **Background Sync**: Çevrimdışı yapılan işlemlerin senkronizasyonu

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Geliştirme Modunda Çalıştır

```bash
npm run client
```

VitePWA devOptions sayesinde service worker development modunda da çalışır.

### 3. Üretim Derlemesi

```bash
npm run build
```

Bu komut:
- Service worker'ı üretir
- Manifest.json'u oluşturur
- İkonları ve asset'leri önbelleğe alır

## PWA Test Etme

### Chrome DevTools

1. Uygulamayı çalıştır: `npm run client`
2. Chrome DevTools → Application sekmesi
3. **Manifest** bölümünü kontrol et
4. **Service Workers** bölümünden kayıt durumunu gör
5. **Clear storage** ile önbelleği temizleyebilirsin

### Lighthouse Audit

1. DevTools → Lighthouse sekmesi
2. "Progressive Web App" seçeneğini işaretle
3. "Analyze page load" butonuna tıkla

### Mobil Cihazda Test

1. Telefon ve bilgisayar aynı ağda olmalı
2. `npm run client` çalıştır
3. Telefondan bilgisayarın IP adresine gir (örn: `http://192.168.1.5:3000`)
4. Chrome'da "Ana ekrana ekle" seçeneği görünecek

## Service Worker Stratejisi

### Cache İlk

```javascript
// Font'lar ve görseller için
handler: 'CacheFirst'
```

### Network İlk

```javascript
// API çağrıları için
handler: 'NetworkFirst'
```

### Stale While Revalidate

```javascript
// Statik asset'ler için
handler: 'StaleWhileRevalidate'
```

## Offline Fallback

Kullanıcı çevrimdışıyken `/offline` rotasında veya ana sayfada `OfflineFallback` component'i gösterilir.

## Ikonlar

Gerekli ikonlar:
- `/public/icon-192.png` (192x192)
- `/public/icon-512.png` (512x512)  
- `/public/apple-touch-icon.png` (180x180)

SVG placeholder kullanılabilir:
```svg
/public/icon-placeholder.svg
```

Gerçek ikonlar eklendiğinde sadece dosyaları değiştirin, yapılandırma değişmez.

## Manifest Özellikleri

```json
{
  "name": "CafeDuo",
  "short_name": "CafeDuo",
  "display": "standalone",
  "theme_color": "#1a1a2e",
  "background_color": "#0f141a",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/"
}
```

## Shortcuts

Ana ekrandan hızlı erişim için 3 shortcut:

1. **Check-in** - Hızlı kafe check-in
2. **Games** - Oyunlara göz at
3. **Rewards** - Mağaza ve envanter

## Sorun Giderme

### Service Worker Güncellenmiyor

```javascript
// Tarayıcı konsolunda:
navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
```

### Cache Temizleme

Chrome DevTools → Application → Storage → Clear site data

### Offline Fallback Görünmüyor

1. Network tabından "Offline" modu aç
2. Sayfayı yenile
3. Fallback component yüklenmeli

## Daha Fazla Bilgi

- [VitePWA Dokümantasyonu](https://vite-pwa-org.netlify.app/)
- [Workbox Dokümantasyonu](https://developer.chrome.com/docs/workbox/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
