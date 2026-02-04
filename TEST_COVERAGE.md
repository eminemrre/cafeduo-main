# 🧪 Test Coverage Tracker

> **Güncelleme:** 2026-02-03  
> **Toplam Test:** 12  
> **Geçen:** 12 ✅  
> **Coverage:** ~15%

---

## 📊 Component Testleri

### ✅ Tamamlanan

| Component | Test Sayısı | Kritik Senaryolar |
|-----------|-------------|-------------------|
| RetroButton | 7 | ✅ Rendering, clicks, disabled, variants, sizes, types |
| AuthModal | 5 | ✅ Login/register render, validation, email, password |

### 🔄 Sırada

| Component | Öncelik | Zorlayıcı Senaryolar |
|-----------|---------|---------------------|
| ToastContext | 🔴 Yüksek | Multiple toasts, auto-dismiss, stack limit |
| useGames hook | 🔴 Yüksek | Game creation, joining, socket events, error handling |
| useRewards hook | 🟡 Orta | Buy reward, inventory loading, points update |
| Dashboard | 🟡 Orta | Tab switching, active game rejoin, responsive layout |
| GameLobby | 🟡 Orta | Empty state, game list, join button disabled state |
| CreateGameModal | 🟡 Orta | Points validation, min/max limits, preset buttons |

---

## 🎯 Hedef Coverage

```
Statements:   70%  [████░░░░░░░░░░] 15%
Branches:     65%  [███░░░░░░░░░░░] 12%
Functions:    75%  [████░░░░░░░░░░] 18%
Lines:        70%  [████░░░░░░░░░░] 15%
```

---

## 📝 Zorlayıcı Test Senaryoları (Gelecek)

### Async & Network
- [ ] Login başarılı → Token kaydetme
- [ ] Login başarısız → Error handling
- [ ] Network timeout handling
- [ ] 500 error recovery

### Edge Cases
- [ ] Çok uzun kullanıcı adı (>50 karakter)
- [ ] Özel karakterler (emoji, unicode)
- [ ] Boş input'lar
- [ ] XSS prevention (input sanitization)

### State Management
- [ ] useGames: Socket disconnect/reconnect
- [ ] useGames: Game state synchronization
- [ ] ToastContext: 10+ toast queue management
- [ ] AuthContext: Token expiration handling

### Integration
- [ ] Dashboard → GameSection → GameLobby data flow
- [ ] Shop purchase → Points update → Inventory refresh
- [ ] Login → Dashboard redirect

---

## 🚀 Günlük Hedef

### Gün 1 (Bugün) - Component Tests
- [x] RetroButton ✅
- [x] AuthModal ✅
- [ ] ToastContext ⏳
- [ ] CreateGameModal ⏳

### Gün 2 - Hook Tests
- [ ] useGames
- [ ] useRewards

### Gün 3 - Page/Integration
- [ ] Dashboard
- [ ] GameLobby
- [ ] RewardSection

### Gün 4 - Advanced
- [ ] Error boundaries
- [ ] Loading states
- [ ] Responsive tests

---

## 🐛 Bulunan Bug'lar (Test ile)

| Bug | Component | Durum |
|-----|-----------|-------|
| `showToast` API yanlış kullanımı | AuthModal, CreateGameModal | ✅ Düzeltildi |

---

**Son Güncelleme:** 2026-02-03  
**Sonraki Test:** ToastContext veya useGames (sen seç)
