# Production Credentials Setup Guide

Bu doküman, CafeDuo production ortamı için gerekli credential'ların nasıl alınacağını ve yapılandırılacağını açıklar.

## 📋 İçindekiler

1. [Google OAuth Credentials](#1-google-oauth-credentials)
2. [reCAPTCHA Keys](#2-recaptcha-keys)
3. [SMTP Email Configuration](#3-smtp-email-configuration)
4. [JWT Secret Generation](#4-jwt-secret-generation)
5. [Environment Variables](#5-environment-variables)

---

## 1. Google OAuth Credentials

### ✅ Mevcut Client ID
```
584645811147-nhnquccakum7g0pias4kj4o8rda7udd2.apps.googleusercontent.com
```

### 🔍 Client Secret Bulma

**Adım 1:** [Google Cloud Console](https://console.cloud.google.com/) - Credentials sayfasına git:
```
https://console.cloud.google.com/apis/credentials
```

**Adım 2:** OAuth 2.0 Client ID'lerini bul:
- Sol menüden: **APIs & Services** → **Credentials**
- Sayfada **OAuth 2.0 Client IDs** bölümünü bul
- Client ID: `584645811147-nhnquccakum7g0pias4kj4o8rda7udd2` olan entry'yi bul

**Adım 3:** Client Secret'ı görüntüle:
- Client ID satırına tıkla
- Açılan modal/sayfada **Client Secret** göreceksin
- Yanındaki **COPY** butonuna tıkla veya manuel olarak kopyala

**Adım 4:** Eğer Client Secret görünmüyorsa:
- **Reset Client Secret** butonuna tıklayarak yeni bir secret oluşturabilirsin
- ⚠️ **DİKKAT**: Bu işlem eski secret'ı geçersiz kılar!

### 🔐 Yapılandırma

`.env` dosyana ekle:
```bash
GOOGLE_CLIENT_ID=584645811147-nhnquccakum7g0pias4kj4o8rda7udd2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_GOOGLE_CLIENT_ID=584645811147-nhnquccakum7g0pias4kj4o8rda7udd2.apps.googleusercontent.com
```

### 📝 Authorized Redirect URIs (Güncelleme)

Google Cloud Console'da aşağıdaki redirect URI'leri ekle/doğrula:
```
https://cafeduotr.com/auth/google/callback
https://www.cafeduotr.com/auth/google/callback
http://localhost:3000/auth/google/callback (development için)
```

---

## 2. reCAPTCHA Keys

### 📸 Görsellerden Alınan Bilgiler

Görsellerden reCAPTCHA keys'leri kopyala ve aşağıdaki formatta ekle:

### 🔑 Site Key (Frontend)
```bash
RECAPTCHA_SITE_KEY=6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 🔐 Secret Key (Backend)
```bash
RECAPTCHA_SECRET_KEY=6LfXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 📝 reCAPTCHA Admin Console

Keys'leri görmek/yönetmek için:
```
https://www.google.com/recaptcha/admin
```

**Domain Ayarları:**
- `cafeduotr.com`
- `www.cafeduotr.com`
- `localhost` (development için)

---

## 3. SMTP Email Configuration

### 📸 Görsellerden Alınan Bilgiler

SMTP bilgilerini görsellerden kopyala:

### Gmail/Google Workspace Örneği:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=noreply@cafeduotr.com
```

### SendGrid Alternatifi (Önerilir):
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@cafeduotr.com
```

### 🔐 Gmail App Password Oluşturma

Eğer Gmail kullanıyorsan:
1. [Google Account Security](https://myaccount.google.com/security) → **App Passwords**
2. **Select app**: Mail
3. **Select device**: Other (Custom name)
4. **Generate** butonuna tıkla
5. Oluşturulan 16 karakterlik password'u kopyala

### ✅ SMTP Testi

Email servisi test etmek için:
```bash
node backend/utils/testEmail.js
```

---

## 4. JWT Secret Generation

### 🔒 Production JWT Secret Oluşturma

**Adım 1:** Güçlü bir secret oluştur:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Çıktı örneği:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6
```

**Adım 2:** `.env` dosyana ekle:
```bash
JWT_SECRET=your-generated-secret-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

### ⚠️ Güvenlik Notları

1. **Asla** JWT_SECRET'ı git'e commit etme
2. Production ve development için **farklı** secret'lar kullan
3. Secret en az **64 karakter** uzunluğunda olmalı
4. Secret'ı **düzenli olarak rotate et** (her 3-6 ayda bir)

---

## 5. Environment Variables

### 📝 Production `.env` Şablonu

```bash
# ==========================================
# PRODUCTION ENVIRONMENT
# ==========================================

# Domain and TLS
SITE_ADDRESS=cafeduotr.com
ACME_EMAIL=ops@cafeduotr.com

# App Security
JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET_HERE
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
TRUST_PROXY=1

# Database
DATABASE_URL=postgres://user:password@localhost:5432/cafeduo
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

# Redis
REDIS_URL=redis://localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=584645811147-nhnquccakum7g0pias4kj4o8rda7udd2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
VITE_GOOGLE_CLIENT_ID=584645811147-nhnquccakum7g0pias4kj4o8rda7udd2.apps.googleusercontent.com

# reCAPTCHA
RECAPTCHA_SITE_KEY=YOUR_RECAPTCHA_SITE_KEY_HERE
RECAPTCHA_SECRET_KEY=YOUR_RECAPTCHA_SECRET_KEY_HERE

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@cafeduotr.com

# Feature Flags
ENABLE_GOOGLE_AUTH=true
ENABLE_EMAIL_VERIFICATION=true
ENABLE_RECAPTCHA=true

# Logging
LOG_LEVEL=info
REQUEST_LOG_SLOW_MS=1200

# Rate Limiting
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=600
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=20
AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS=10

# CORS
CORS_ORIGIN=https://cafeduotr.com,https://www.cafeduotr.com
```

### 🔒 GitHub Secrets (CI/CD)

GitHub repository settings'de şu secret'ları ekle:

**Deploy Secrets:**
- `DEPLOY_HOST` - VPS IP adresi
- `DEPLOY_USER` - SSH username
- `DEPLOY_SSH_KEY` - SSH private key
- `DEPLOY_PATH` - Deploy path (örn: `/home/user/cafeduo`)
- `DEPLOY_ENV_B64` - Base64 encoded `.env` file
- `DEPLOY_SITE_URL` - https://cafeduotr.com

**Test Secrets:**
- `TEST_USER_EMAIL` - Test kullanıcı email
- `TEST_USER_PASSWORD` - Test kullanıcı password
- `SMOKE_LOGIN_EMAIL` - Smoke test email
- `SMOKE_LOGIN_PASSWORD` - Smoke test password

### 📦 Base64 Encoding `.env` for GitHub

`.env` dosyanı base64'e çevir:
```bash
cat .env | base64 -w 0
```

Çıktıyı `DEPLOY_ENV_B64` secret'ına kopyala.

---

## 🔍 Doğrulama Checklist

Tüm credential'lar doğru şekilde yapılandırıldıktan sonra:

- [ ] Google OAuth login çalışıyor
- [ ] reCAPTCHA register/login sayfalarında görünüyor
- [ ] Email gönderimi çalışıyor (password reset test et)
- [ ] JWT token'lar generate ediliyor ve doğrulanıyor
- [ ] GitHub Actions CI/CD pipeline başarıyla çalışıyor
- [ ] Production deployment başarılı

---

## 📞 Sorun Giderme

### Google OAuth Error

**Hata**: "redirect_uri_mismatch"
- **Çözüm**: Google Cloud Console'da redirect URI'leri doğrula

**Hata**: "invalid_client"
- **Çözüm**: Client ID ve Secret'ı kontrol et

### reCAPTCHA Error

**Hata**: "Invalid reCAPTCHA response"
- **Çözüm**: Site key frontend'de, secret key backend'de olduğundan emin ol

### SMTP Error

**Hata**: "Authentication failed"
- **Çözüm**: Gmail için App Password kullandığından emin ol

### JWT Error

**Hata**: "invalid signature"
- **Çözüm**: Frontend ve backend aynı JWT_SECRET kullanıyor mu kontrol et

---

## 📚 Referanslar

- [Google Cloud Console](https://console.cloud.google.com/)
- [reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
