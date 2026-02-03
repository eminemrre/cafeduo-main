# CafeDuo

Oyunlaştırılmış kafe sadakat platformu. Öğrenciler kafede check-in yaparak birbirleriyle oyun oynar, puan kazanır ve ödüller alır.

## Özellikler

- 🎮 **Multiplayer Oyunlar**: Taş Kağıt Makas, Gladyatör Arenası
- 📍 **Kafe Check-in**: PIN ile masa doğrulama
- 🏆 **Puan ve Liderlik**: Kazanarak puan topla, sıralamaya gir
- 🎁 **Ödül Mağazası**: Puanlarla kafe ödülleri

## Teknolojiler

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js
- **Veritabanı**: PostgreSQL
- **Gerçek Zamanlı**: Socket.IO

## Kurulum

### Gereksinimler
- Node.js (v18+)
- PostgreSQL

### Adımlar

1. **Bağımlılıkları yükle**:
   ```bash
   npm install
   ```

2. **Veritabanını oluştur**:
   ```bash
   createdb cafeduo
   psql cafeduo < schema.sql
   ```

3. **Çevre değişkenlerini ayarla**:
   ```bash
   cp .env.example .env
   # .env dosyasını düzenle
   ```

4. **Uygulamayı çalıştır**:
   ```bash
   npm run dev
   ```

   Bu komut hem backend (port 3001) hem de frontend (port 3000) sunucularını başlatır.

## Scriptler

- `npm run dev` - Hem frontend hem backend'i başlatır
- `npm run server` - Sadece backend'i başlatır (nodemon)
- `npm run client` - Sadece frontend'i başlatır
- `npm run build` - Production build alır

## Proje Yapısı

```
cafeduo-main/
├── backend/           # Express.js API
│   ├── server.js     # Ana sunucu
│   └── db.js         # Veritabanı bağlantısı
├── components/       # React bileşenleri
├── lib/              # Yardımcı fonksiyonlar
├── public/           # Statik dosyalar
└── schema.sql        # Veritabanı şeması
```
