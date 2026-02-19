# CafeDuo Sunumu (Kullanıcı + Kafe + Akademik)

## 1. Kapak
- Başlık: CafeDuo
- Alt başlık: Kafede bekleme süresini eşleşmeli oyun ve ödül döngüsüne çeviren sosyal altyapı
- Konuşma cümlesi: "Biz, kafede bekleyen kullanıcıyı aktif oyuncuya dönüştürüyoruz."

## 2. Problem
- Kafede bekleme anı pasif geçiyor.
- Kullanıcı için sıkılma, kafe için düşük etkileşim oluşuyor.
- Kısa bekleme penceresinde değer üreten bir dijital akış çoğu işletmede yok.

## 3. Çözüm
- Kullanıcı kafeye güvenli giriş yapar.
- Sistem aynı kafedeki aktif oyuncularla anlık eşleştirir.
- Kısa tur oyun biter, puan anında cüzdana yansır.
- Puan ödüle dönüşür, kullanıcı-kafe bağı güçlenir.

## 4. Nasıl Çalışıyor? (3 Adım)
- 1: Hesabını aç (yaklaşık 20 sn)
- 2: Kafeye bağlan, güvenli girişi tamamla (yaklaşık 15 sn)
- 3: Eşleş, oyna, puanı al (yaklaşık 45 sn)

## 5. Kullanıcıya Değer
- Bekleme süresi boşa gitmez, keyifli hale gelir.
- Kısa tur yapısı: zaman baskısına uygun hızlı oyun deneyimi.
- Kazanım döngüsü net: maç -> puan -> ödül.
- Arkadaşını beklerken bile sosyal etkileşim devam eder.

## 6. Kafe Sahibine Değer
- Masada geçirilen süre artar.
- Kullanıcı etkileşimi ve tekrar ziyaret motivasyonu yükselir.
- Ödül ekonomisiyle ölçülebilir sadakat modeli oluşur.
- Kafe paneliyle operasyonel kontrol tek yerden yapılır.

## 7. Akademik / Teknik Değer
- Gerçek zamanlı çok oyunculu senkronizasyon pratiği.
- Rol bazlı yetkilendirme ve güvenli erişim tasarımı.
- Canlı dağıtım (CI/CD + VPS) ve kalite kapıları.
- Ölçülebilir ürün yaklaşımı: test, sürüm, smoke doğrulama.

## 8. Şu Ana Kadar Başardıklarımız
- Canlı sistem çalışır durumda (health + version doğrulanıyor).
- Kullanıcı, kafe admin, sistem admin panelleri hazır.
- Oyun lobi/eşleşme ve puan ekonomisi aktif.
- Son revizyonla anasayfa metni kullanıcı odaklı yeniden konumlandı.
- Test durumu: 521/521 test geçti.

## 9. Neden Farklıyız?
- Sadece oyun değil, bekleme anını işletme değerine çeviren altyapı.
- Kısa tur tasarımıyla mobil/düşük dikkat penceresine uygun deneyim.
- Kullanıcı ve kafe için aynı anda değer üreten çift taraflı model.

## 10. Yol Haritası (Sonraki 3 Sprint)
- Sprint 1: Eşleşme motoru ve reconnect/timeout dayanıklılığı
- Sprint 2: Kafe analitik paneli (aktif kullanıcı, maç tamamlama, ödül dönüşüm)
- Sprint 3: Ürün büyüme katmanı (kampanya, turnuva, referans)

## 11. KPI Takibi
- Eşleşme başarı oranı
- Maç tamamlama oranı
- Günlük aktif kullanıcı (DAU)
- Ödül kullanım oranı
- Tekrar ziyaret oranı

## 12. Kapanış Mesajı
- CafeDuo, "bekleme"yi "değer"e çeviren bir sosyal oyun altyapısıdır.
- Kullanıcı eğlenir ve kazanır; kafe etkileşim ve sadakat kazanır.
