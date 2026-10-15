# CafeDuo otomasyon raporu — 2 Ekim 2026, avatar kaydı ve ortak kullanıcı state’i

## Başlangıç ve audit

Güncel `work/release` başlangıcı `08c907670e22d18f27918293d344e34d8f43106c`; temiz ve origin/main ile 0/0 farkta. Son commitler, önceki profil/veri ve yerel avatar raporları ile canlı yayın sonucu incelendi. Canlı kaynak önceki turun `c0658af` sürümüydü. Paylaşılan ana repository’deki sekiz kaydedilmemiş girdi ve eski snapshot korundu. Dal: `fix/profile-avatar-sync-2026-10-02`.

Product/UX, visual design, frontend mimarisi, performans, erişilebilirlik ve QA profil→avatar seçimi→kayıt→üst kart→yeniden açma/bölüm kaydı yolculuğunda birlikte değerlendirildi. Önceki 16 yerel SVG, görüntü yedeği, gerçek geçmiş ve özel veri izolasyonu yeniden uygulanmadı.

## Önemli problemler

- Avatar kaydı yalnız `UserProfileModal` içindeki state’i değiştiriyordu; `AuthContext` ve cache güncellenmiyordu. Üst kart eski avatarı gösteriyor, pencere yeniden açılınca eski seçim geri geliyordu.
- Sonraki bölüm/istatistik güncellemesi eski currentUser avatar URL’sini sunucuya yeniden gönderebiliyordu; seçim kaybedilebiliyordu.
- Avatar effect’i avatar prop değişimini izlemiyor; bölüm değişimiyle aynı effect içinde gereksiz yere yeniden kuruluyordu.
- Kayıt başlamadan yerel avatar değiştirilerek henüz onaylanmamış seçim gösteriliyordu. Picker aria-busy/disabled içeriyor, görünür kaydetme durumu içermiyordu.
- Production build QA’da seçim düğmesi disabled olunca aktif klavye odağının pencere dışına taşındığı görüldü; bu bulgu düzeltilmeden tamamlandı sayılmadı.

## Seçilen görevler ve gerekçe

Son kaydedilmiş tercihin tüm kullanıcı yolculuğunda tutarlı kalması ve sonraki bölüm kaydında kaybolmaması, yeni görsel özellikten daha yüksek kullanıcı değeri taşıyor. Avatarı mevcut sunucu-onaylı ortak kullanıcı güncelleme yoluna bağlamak, bekleyen/hatalı kayıtta eski onaylı bilgiyi korumak ve klavye odağını sabit tutmak birlikte seçildi.

## UI/UX iyileştirmeleri

- Sunucu onayından sonra profil, üst kart ve kullanıcı cache’i birlikte güncellenir. Profil yeniden açıldığında ve bölüm kaydından sonra aynı seçim kalır; sayfa yenilemek gerekmez.
- Kayıt sürerken “Avatar kaydediliyor…” role=status ile gösterilir; seçenekler devre dışıdır, onaylı avatar/seçili halka/cache değişmez. Durum alanının min yüksekliği başlık ile kaydetme metni geçişinde alanı korur.
- Hata son onaylı seçimi korur; picker açık kalır, mevcut role=alert ve tekrar deneme akışı sürer. Başarılı tekrar sonrası açan avatar düğmesine odak döner.
- Seçimden sonra, seçenekler disabled olmadan önce odak aktif pencerenin kapatma düğmesine taşınır. Escape/kapatma kullanılabilir; arka sayfaya odak kaybolmaz.
- Avatar prop güncellemesi devam eden bölüm düzenlemesini sıfırlamaz. Mevcut krem/pembe/mavi kimlik, tipografi, kart, responsive iç scroll ve reduced-motion sistemi korundu; yeni animasyon eklenmedi.

## Teknik iyileştirmeler ve dosyalar

- `components/Dashboard.tsx`: tipli onSaveAvatar callback’i mevcut onUpdateUser(..., {throwOnError:true}) yoluna bağlandı. App’in mevcut serverUser→AuthContext/cache akışı kullanılır; ikinci bir API PUT veya bağımsız global state eklenmez.
- `components/UserProfileModal.tsx`: onSaveAvatar callback’i, sunucu onayı sonrası yerel gösterim, ayrı avatar prop effect’i; kayıt hatasında erken gösterim/rollback kaldırıldı. Callback verilmeyen standalone kullanımın mevcut API fallback’i korunur.
- `components/AvatarPickerModal.tsx`: görünür/erişilebilir kayıt durumu, sabit durum alanı ve disabled seçenekten kalıcı kapatma kontrolüne odak aktarımı.
- `components/UserProfileModal.test.tsx`: pending/failure/retry ve callback yolunun tek kaydı; avatar prop değişiminde bölüm taslağının korunması; standalone fallback — 3 yeni test.
- `e2e/avatars.spec.ts`: dört viewportta yenilemeden üst kart/yeniden açılan profil, bölüm kaydından sonra avatarın kalması, reload/aria-pressed; yeni bekleyen/hatalı kayıt, cache koruması, odak ve başarılı retry senaryosu.
- Bu rapor.

Yeni dependency, polling, API endpoint, backend yetkisi, şema veya migration eklenmedi. Mevcut PUT /users/:id kontratı korunur. Dashboard JS gzip 55.09→55.14 kB; giriş JS 114.96 kB aynı. Saha Core Web Vitals ölçümü yapılmadı.

## Doğrulama

- Son `npm run verify`: **exit 0**, audit **0 açık**, lint/typecheck başarılı, **116 suite / 1.357 test**, line coverage **%81.27**, production build **12.36 saniye**.
- Son kaynak için tam Chromium + Firefox E2E: **112/112 geçti** (56 Chromium, 2.2 dk; 56 Firefox, 2.9 dk); iki süreç **exit 0**. Önceki parola, masa kodu, profil verileri/özel veri izolasyonu, dialog, oyun ve ödül akışları korundu. İlk Chromium 56/56 sonrasında QA odak bulgusu düzeltilince verify, build, production QA ve iki tam tarayıcı paketi son kaynakta tekrar geçti. Timeout değerleri değiştirilmedi.
- Production build Chromium + Firefox × 320×568, 568×320, 768×1024, 1440×900 × success/retry = **16 senaryo / 32 ekran** geçti; script **exit 0**. Bekleyen kayıt, son onaylı görsel/cache, disabled düğmeler, pencere içi odak, hata/retry, nested Escape/odak dönüşü, üst karta yansıma, yeniden açma/seçili avatar, bounds/yatay taşma ve JS pageerror doğrulandı. Temsili mobil pending, yatay mobil pending ve tablet onaylı profil görüntüleri incelendi.
- İlk unit denemesinde genel status seçicisi bağımsız profil veri loading durumlarıyla da eşleşti; kaydetme durumuna daraltıldı. İlk production QA klavye odağı kaçışını buldu; closeButton ref ile düzeltildi, verify/build/QA son kaynakla yeniden geçti.
- `git diff --check` geçti. `npm run migrate:status` yerel PostgreSQL erişilemediği için uygulanmış migration listesini doğrulayamadı; şema değişikliği yok. Yerel API E2E mevcut memory fallback kullanır.

Kanıtlar `outputs/avatar-sync-*` dosyalarında. PR/CI/canlı yayın sonrası sonuçlar `outputs/2026-10-02-profile-avatar-sync-release.md` dosyasına eklenecek.

## Kalan riskler ve sonraki yüksek etkili işler

1. Kullanıcı profil PUT endpoint’i avatar/bölüm yanında istemci istatistik snapshot’ını da ister. Profil alanlarını istatistik yazımından ayıran kısmi güncelleme kontratı, eşzamanlı oyun sonuçlarıyla stale veri riskini azaltmak için ayrı backend turunda değerlendirilmeli; bu tur mevcut kontrat değiştirilmedi.
2. Genel, turnuva, kupon ve admin pencerelerinin kalan klavye/odak audit’i yüksek etkili frontend adayı.
3. Önceki dağıtımda kısa 502 gözlendi; kesintisiz servis geçişi ayrı mühendislik adayı.
4. Safari/WebKit yerel ICU kısıtı nedeniyle doğrulanmadı; gerçek touch/ekran okuyucu ve saha CWV ölçümü yapılmadı. Tam WCAG/CWV sonucu iddia edilmiyor.
5. Katalog dışı eski avatar URL’leri uzak servise bağlı; önceki turun güvenilir baş harf yedeği geçerli. Envanter servisinin yerel DB olmadan memory fallback eksikliği önceki raporda kayıtlı.

Önceki görsel düzen yeniden tasarlanmadı; bu tur kaydedilen kullanıcı tercihinin güvenilirliğine odaklandı.
