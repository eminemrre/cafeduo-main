# 🧠 Lessons Learned (Self-Improvement)

> ODESUS kuralı: Her düzeltmeden sonra bu dosyayı güncelle.
> "Bu hatayı bir daha yapmamak için hafızana yeni bir kural ekle."

---

## 📋 Temel Kurallar

### 1. ONAY OLMADAN HAREKET YOK
```
Kod yazmaya başlamadan önce yaklaşımını anlat ve ONAYIMI BEKLE.
Eğer isteklerim net değilse, kafana göre doldurma; soru sor.
```

### 2. 3 DOSYA KURALI
```
Eğer vereceğim görev 3'ten fazla dosyayı değiştirmeyi gerektiriyorsa DUR.
İşi daha küçük, yönetilebilir parçalara bölmeni iste.
```

### 3. HASAR TESPİTİ
```
Kodu yazdıktan sonra; bu değişikliğin neleri bozabileceğini listele ve
bunu kontrol etmek için hangi testleri yapmamız gerektiğini öner.
```

### 4. KÖRDÜĞÜM ÇÖZÜMÜ (TDD)
```
Bir hata (bug) bulduğunda rastgele düzeltme yapma.
Önce o hatayı tekrarlayan bir test yaz, sonra o test geçene kadar düzelt.
```

### 5. SÜREKLİ ÖĞRENME
```
Seni her düzelttiğimde, bu hatayı bir daha yapmamak için
hafızana (veya kurallar dosyasına) yeni bir kural ekle.
```

---

## 📝 Öğrenilen Dersler

### 2026-02-05
- [x] `.env.ai` API anahtarları eski olabilir - test et
- [x] Fish shell'de parantezler sorun çıkarır - tek tırnak kullan
- [x] OpenRouter SDK tercih et - daha stabil

### Genel
- [ ] Approval First: Asla plan onayı olmadan kodlamaya başlama
- [ ] 3-File Rule: Görev >3 dosyayı etkiliyorsa parçala
- [ ] TDD for Bugs: Bug'ları test ile önce tekrarla

---

## ⚠️ Anti-Patterns (YAPMA!)

1. ❌ Kullanıcıya sormadan büyük refactoring başlatma
2. ❌ Test yazmadan prod kodu değiştirme
3. ❌ Birden fazla problemi tek commit'te çözme
4. ❌ Hata mesajını okumadan "çalışıyor" demek
