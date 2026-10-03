# CafeDuo — Stitch CLI ve 3D prototip, 3 Ekim 2026

## Durum ve önemli problemler

Kullanıcı önceki landing tasarımını yetersiz buldu ve özellikle Stitch CLI ile dinamik 3D sayfalar istedi. Önceki sonucun istenen görsel seviyeye ulaştığı iddia edilmiyor. Mevcut `origin/main` ve son raporlar incelendi; çalışma `feat/stitch-3d-landing-2026-10-03` dalında yapılıyor.

Stitch CLI başta kurulu değildi. Google Labs deposunu işaret eden `@google/stitch@0.11.0`, uygulama bağımlılıklarına eklenmeden görev `work/stitch-tools` altında kuruldu. CLI'nin kendi `skills/design/stitch/SKILL.md` ve ekran üretimi referansı okundu. `stitch status --flow=design --json`, tasarım/Canvas oturumunun eksik olduğunu doğruladı. Google OAuth giriş denemesi kullanıcı girişini beklerken zaman aşımına uğradı. **Canvas tasarımı üretilmedi; Stitch ile üretilmiş tasarım iddiası yok.** Kullanıcıdan Google/Stitch bağlantısını güvenli yerel yöntemle tamamlaması istendi; secret sohbete istenmedi.

## Seçilen görevler ve öncelik

1. Bağlantı beklenirken bağımsız yapılabilecek gerçek 3D sahne altyapısını ve yerel prototipi hazırlamak. Flat dekor eklemek yerine perspektif, gerçek materyal, ışık ve obje hareketi sağlar.
2. Hero'yu 3D kahve/oyun kompozisyonuna ayırmak; oynanabilir satranç demosunu ayrı bir deneme bölümüne taşımak. Görsel odak ve ilk kullanıcı aksiyonu birbirini destekler.
3. Yerel kaynaklar, lazy import, hareketi durdurma, reduced-motion, offscreen/hidden durma, context-loss fallback ve GPU cleanup. Tasarımın erişilebilirlik/performance bedelini kontrol eder.
4. Prototipin gerçek Stitch CLI capture'ını ve üretime hazır tasarım brief'ini hazırlamak. Hesap bağlanınca public landing ve kafe sahipleri sayfası için Stitch tasarımları üretilecek; mevcut prototip o aşama tamamlanmış gibi yayımlanmayacak.

## Değiştirilen dosyalar

- `components/Hero.tsx`
- `components/LandingExperience.tsx`
- `components/CafeScene3D.tsx`
- `components/CafeScene3D.test.tsx`
- `lib/createCafeScene.ts`
- `styles/playground.css`
- `index.tsx`
- `package.json`
- `package-lock.json`
- `docs/automation/2026-10-03-stitch-3d-prototype.md`

## UI/UX ve teknik iyileştirmeler

- Yerel prosedürel seramik fincan, pembe satranç atı ve mavi jeton; gerçek WebGL, perspektif, çevre ışığı ve yumuşak temas gölgesi. Harici model, texture CDN, iframe veya çalıştırılabilir üçüncü taraf embed yok.
- Büyük tipografi, krem/pembe/kobalt paleti, daha net hero odağı ve ayrı, klavyeyle oynanabilir demo. Üyelik, giriş ve role göre panel yönlendirme korunuyor.
- Sahne seçimleri native butonlarla çalışır; `aria-pressed` ve görünür focus vardır. Dekoratif canvas ekran okuyucudan gizlenir; anlamlı metin ve CTA HTML'de kalır. Touch sahnede doğal dikey scroll korunur.
- WebGL olmadan yerel illüstrasyon kalır. Sahne, görünür alana gelince dinamik import ile başlar; ekran dışında veya gizli sekmede durur. Reduced-motion/pause tercihi 3D döngüsünü durdurur. DPR en fazla 1,5 ve çizim en fazla 30 fps; geometry/material/environment/texture/render kaynakları unmount'ta temizlenir.
- İlk QA'daki 768px taşmanın kökü görünmez fallback illüstrasyonun taşmasıydı; yalnızca o dekoratif katmanın sınırı düzeltildi. Dar viewport'ta kamera kadrajı nesneleri kesmeyecek şekilde güncellendi. Tüm sayfaya overflow gizleyerek hata örtülmedi.
- Three.js dinamik chunk yaklaşık **567 kB / 145 kB gzip**; ana JS yaklaşık **364,5 kB / 117,8 kB gzip**. Ek runtime maliyeti var; sahne opsiyonel ve lazy. Backend güvenlik düzeltmeleri ve oturum/CSRF/rate-limit davranışı değiştirilmedi.

## Stitch CLI kanıtı

- `stitch capture http://127.0.0.1:4173 ... --json`: **success**, hydrated HTML capture **318319 byte**, yüklenme göstergesi yok. Capture ve screenshot görev çıktılarında yerel tutuldu; Canvas'a yüklenmedi.
- `stitch generate screen ... --dry-run --json`: **success**, gerçek generation çağrısı değildir. İki sayfa için brief `outputs/stitch-cafeduo-brief.md`, doğrulanan payload `outputs/stitch-3d-generation-dry-run.json` altında.
- Son auth kontrolü: `authenticated=false`, Canvas credential present `false`. Üretimi tamamlamak için Google/Stitch hesabı bağlantısı gerekir; API anahtarı frontend'e veya repository'ye konmamalıdır.

## Doğrulama

- Odaklı Jest: **15/15**, Hero, hareket tercihi ve sahne lifecycle testleri. İlk sahne kontrollerindeki accessible name hataları test yardımında düzeltildi; son odaklı çalıştırma geçti.
- Son `npm run verify`: **başarılı**, **1401/1401 test**, **120 suite**; line coverage **%79,92**. WebGL çiziminin doğrulaması jsdom coverage yerine gerçek tarayıcı kontrolleriyle ayrıca yapıldı.
- Lint/typecheck ve production build geçti; build **17,62 saniye**. Tam dependency audit **0**. Dinamik Three.js chunk'ı için Vite'ın 500 kB uyarısı mevcut; uyarı sınırı yükseltilmedi.
- Gerçek Chromium WebGL QA: **3/3 viewport** (1440, 768 ve 320px); pause sonrası iki canvas bölgesi pixel olarak aynı, hareket açıkken farklı. Reduced-motion, klavye sahne seçimi ve offscreen durma geçti. Yazılımsal WebGL için açık SwiftShader desteği kullanıldı; fiziksel cihaz FPS ölçümü iddiası yok.
- Genel production preview QA: **16/16** senaryo, Chromium/Firefox; dört viewport × normal/reduced-motion, **48 görsel**. En yüksek ölçülen Chromium CLS **0,06288**; JS/CSP hatası veya yatay taşma yok. Son CTA, satranç klavye demosu ve hareket kontrolleri geçti.
- İlk tam Playwright: **131 geçti / 1 başarısız**; başarısız olan Chromium 768px landing taşmasıydı ve düzeltildi. İlk tam çalıştırmaya 132/132 geçti denmiyor. Son bütün landing tekrarı Chromium/Firefox'ta **14/14 geçti** (**1,2 dakika**); mobil/landscape/tablet/desktop, hareket tercihi, storage/observer fallback ve girişli panel geçişi dahil.
- Ardışık tekrar sırasında Chromium panel geçişi başarısız oldu. Stitch capture yardımcı tarayıcısının açık kalan SwiftShader GPU süreci test makinesinde yaklaşık %637 CPU kullanıyordu. Yalnızca bu görevin yardımcı süreçleri kapatıldı; kod/test timeout değiştirilmeden izole panel geçişi Chromium ve Firefox'ta **2/2 geçti**. Capture sonrası açık tarayıcı bırakmamak gerekiyor. Son bütün landing tekrarının logu: `outputs/stitch-3d-e2e-landing-clean-final.log`.
- WebKit bu ortamda gerekli sistem kitaplığı eksikliği nedeniyle çalıştırılmadı. Veritabanı şeması değişmedi; mevcut yerel PostgreSQL erişim sınırı korunuyor.

## Riskler, yayın ve sonraki adımlar

- **Yerel, tamamlanmamış tasarım prototipi. Canlıya dağıtılmadı.** Kullanıcının özellikle istediği Stitch üretimi oturum eksikliği nedeniyle bekliyor. Kafe sahipleri sayfasının yeni Stitch/3D tasarımı da bu aşamadan sonra yapılacak.
- Bu sahne ürünün kullanılabilmesi için zorunlu değildir. WebGL desteklemeyen cihazlar fallback kullanır; gerçek Safari/GPU cihazları ek doğrulama gerektirir. İlk preload/font zamanlamasında CLS önceki sade sayfadan daha yüksek; ölçüm 0,1 eşiğinin altında olsa da final tasarımda iyileştirilecek.
- Stitch bağlantısı sonrası: desktop ve mobile yeni art direction üretimi, tasarım varyantlarının görsel incelemesi, iki sayfada tutarlı implementation, scroll/3D koreografisi, tekrar QA ve mevcut güvenli yayın süreci.
- Ana paylaşılan repository'deki **8 kaydedilmemiş değişiklik korundu**. Bu prototip dalındaki kaydedilmemiş değişiklikler başka otomasyonlarca silinmemeli veya final tasarım gibi yayımlanmamalıdır.

Yerel önizleme: `http://127.0.0.1:4173`. Kanıtlar görev `outputs/stitch-3d-*` logları, capture, QA JSON ve ekran görüntüleri altında.

## 07:09 UTC otomasyon turu devam notu

Sunucu istatistik yetkisi ve doğru oturum/bakiye yenileme düzeltmeleri PR #28 ile canlıya yayımlandı. Prototip main ile fast-forward güncellendi; mevcut 10 prototip dosyası bu güncellemede byte bazında korundu. Stitch oturumu hâlâ eksik, tasarım tamamlanmadı ve 3D prototipi canlıya dağıtılmadı.

Ek yerel Chromium panel geçişi kontrolünde yeniden 5 saniye başarısızlığı görüldü. Tanılama, geç çözülen sahne import'unun ekran dışına çıkıldıktan sonra GPU'yu başlattığını gösterdi. `CafeScene3D` artık görünürlüğe göre bekleyen init'i iptal eder, yeniden görünür olduğunda yüklemeyi dener; hazır sahne görünürlük değişiminde korunup unmount'ta temizlenir. Geometri, ışık, kamera, palet ve CSS değiştirilmedi. Bu lifecycle düzeltmesi ve yeni regression testi yereldir.

Son kontroller: odaklı sahne/hareket/Hero **16/16**; route Chromium/Firefox **2/2**; tüm landing **14/14**, **1,1 dakika**; tam prototype verify audit **0**, lint/typecheck/build başarılı, **1409/1409**, **121 suite**, satır coverage **%79,93**; gerçek Chromium WebGL **3/3**. Timeout artırılmadı. Eski WebGL artifact'ları `outputs/previous-stitch-3d-before-cancellation` altında korundu. Bu sonuçlar, önceki turdaki 1401 testlik farklı snapshot'ın üzerine yapılan kontrol olarak okunmalıdır.

Canlıya yayımlanan güvenlik düzeltmeleri ve yerel 3D takip işi `docs/automation/2026-10-03-0709-server-owned-statistics-release.md` nihai raporunda ayrıntılıdır.

## Sonraki uygulama turu

OAuth bağlantısı ve gerçek Stitch üretimi 3 Ekim'de tamamlandı. İki Canvas ekranı üretildi; bu belgedeki önceki “auth eksik / generation yapılmadı” ifadeleri ilk prototipin tarihsel durumudur. Son uygulanmış tasarım, görünür teknik metin temizliği ve yayın doğrulaması `2026-10-03-stitch-ceramic-landing.md` raporunda izlenir.
