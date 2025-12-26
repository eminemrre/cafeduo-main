#!/bin/bash

echo "🚀 CafeDuo Güncelleme Başlatılıyor..."

# 1. Kodları Çek
echo "📥 Git Pull..."
git pull origin main

# 2. Backend Güncelle
echo "🛠️ Backend Kurulumu..."
cd backend
npm install
cd ..

# 3. Frontend Güncelle ve Build Et
echo "🎨 Frontend Build..."
npm install
npm run build

# 4. Servisleri Yeniden Başlat
echo "🔄 Servisler Yeniden Başlatılıyor..."
pm2 restart cafeduo-api

echo "✅ Güncelleme Tamamlandı! İyi eğlenceler. 🎉"
