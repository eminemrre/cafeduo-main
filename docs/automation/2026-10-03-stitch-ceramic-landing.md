# CafeDuo — Stitch 3D tasarım ve görünür metin temizliği, 3 Ekim 2026

## Audit ve öncelik

`work/release` başlangıçta `origin/main` ile 0/0 farkındaydı (`aefdb90`). Önceki raporlar ve bekleyen yerel 3D taslağı incelendi. Eski snapshot yeniden uygulanmadı. Ana paylaşılan repository'deki sekiz kaydedilmemiş değişiklik korunuyor.

Kullanıcı, önceki tasarımın görsel seviyesini yetersiz bulmuş, Stitch CLI ile dinamik 3D sayfalar istemiş ve sonrasında görünür “Hareketi aç/durdur” türü teknik metinlerin her yerden kaldırılmasını özellikle belirtmişti. Bu turun önceliği, gerçek Stitch tasarım üretimini React uygulamasına uyarlamak ve tüm pazarlama yolculuğunda aynı kaliteyi sağlamaktır.

## Seçilen görevler

1. OAuth bağlantısı doğrulanan Stitch CLI ile oyuncu ve kafe sahibi için iki gerçek tasarım üretmek. Önceki dry-run gerçek generation gibi raporlanmadı.
2. Tek sayfa ritmi içinde 3D hero, ayrı oynanabilir demo, kullanıcı adımları, oyun seçimi ve CTA'ları düzenlemek. Kafe sahipleri sayfasını aynı kimlikle birleştirmek.
3. Görünür hareket yönergelerini, PLAYGROUND etiketini, tekrar eden helper metinlerini ve footer sürüm/build rozetini kaldırmak. Erişilebilir isimler ikonların `aria-label` değerlerinde korunur.
4. QA'da ölçülen mobil layout shift ve bekleyen route-exit animasyonunun panel geçişini engellemesini düzeltmek. Bu sorunlar doğrulanmadan yayın yapılmaz.

## Stitch kanıtı

- Resmi `@google/stitch@0.11.0` CLI görev araçları altında; frontend bağımlılığı değildir.
- Gerçek OAuth girişinden sonra auth/Canvas ve API proje okuması başarılı.
- İki `generate screen` çağrısı başarılı: oyuncu `dc5a409b8b85444e8fc061d29a550745`, işletme `dd1a4ee117f8400ba5b0941686ccd409`.
- CLI tarafından döndürülen [tasarım projesi](https://stitch.google.com/projects/17019580352055421782). Global binding veya batch upload yapılmadı.
- JSON, PNG ve HTML çıktıları görev `outputs` dizininde saklandı. Üretilen sayaç, rozet, CDN ve inline executable code üretime alınmadı. Seramik fincan/at/jeton, krem-pembe-kobalt paleti ve sayfa hiyerarşisi mevcut React akışlarına uyarlanıyor.

## Değiştirilen dosyalar

- `App.tsx`
- `components/Hero.tsx`
- `components/BusinessLanding.tsx`
- `components/Navbar.tsx`
- `components/Footer.tsx`, `components/Footer.test.tsx`
- `components/LandingExperience.tsx`, `components/LandingExperience.test.tsx`
- `components/CafeScene3D.tsx`, `components/CafeScene3D.test.tsx`
- `lib/createCafeScene.ts`
- `styles/playground.css`
- `index.tsx`
- `package.json`, `package-lock.json`
- `e2e/landing.spec.ts`
- `DESIGN.md`
- Önceki taslak ve doğrulanmış güvenlik yayın raporları; bu rapor.

## UI/UX ve teknik sonuç

Gerçek prosedürel WebGL kompozisyonu, fiziksel materyaller, çevre ışığı ve yumuşak temas gölgesi kullanılır. Oyuncu ve işletme için büyük tipografi, aynı responsive navigasyon, krem/pembe/kobalt yüzeyler ve net CTA vardır. Satranç demosu, hero'dan bağımsız bir deneme bölümünde kalır. Mevcut üyelik, giriş, role göre panel, WhatsApp/e-posta, pilot ve fiyatlandırma akışları korunur.

Hareket ve obje seçimleri 44px ikon kontrolleridir; tooltip veya teknik metin gösterilmez. Ekran okuyucu isimleri, native keyboard controls, görünür focus, sistem reduced-motion ve sekme içi pause tercihi korunur. Footer diagnostics yalnızca HTML metadata ve readiness API üzerinden doğrulanır. 320px CTA metni tek satırda kalır.

Sahne görünürken lazy import edilir, ekran dışında/gizli sekmede durur; geç import route'tan ayrıldıktan sonra GPU kurmaz. DPR 1,5 / en fazla 30fps; harici model, texture veya executable embed yok. WebGL hatasında statik fallback ve HTML CTA kalır; unmount'ta GPU kaynakları temizlenir.

İlk işletme QA'sında footer, `60vh` route loader'dan sayfa yüklenince ekran dışına sıçradığı için mobil CLS yaklaşık 0,344 çıktı. Loader bir viewport yüksekliğine ayrıldı ve erişilebilir status adı verildi. Sonraki ölçüm 0,0017 civarındadır. Panel yönlendirmesinde URL değişirken eski landing'in bekleyen exit animasyonu kalıyordu. Route içeriği artık animasyon tamamlanmasını beklemeden commit edilir; pazarlama sayfasındaki 3D ve kontrollü reveal etkileşimleri sürer.

## Doğrulama

Son kaynak `npm run verify`: audit **0**, lint/typecheck/build başarılı; **1409/1409 test, 121 suite**, line coverage **%79,96**. Ana JS **363,75kB / 117,61kB gzip**, lazy sahne **567,5kB / 145,18kB gzip**. Prettier ve `git diff --check` başarılı; strict audit gate tüm kategorilerde **0**.

Production preview oyuncu **16/16**, işletme **16/16** senaryo: Chromium/Firefox × 320×568, 568×320, 768×1024, 1440×900 × normal/reduced-motion. Toplam **96 screenshot**; JS/CSP hatası ve yatay taşma yok. Chromium en yüksek CLS oyuncu **0,05965**, işletme **0,001657**. WebGL **3/3**; pause pixel-stable, açıkken pixel değişimi, offscreen/reduced-motion durma ve keyboard sahne seçimi geçti.

Route düzeltmesinden sonraki tam E2E **130 geçti / 2 başarısız**; iki başarısızlık, koşu başladıktan sonra kaldırılan footer sürüm rozetini hâlâ arayan eski test cache'inden geldi. Bu koşuya 132/132 geçti denmez. Son güncellenmiş public landing testleri aşağıdaki son kayıtta ayrıca doğrulanır. Diğer 130 akış ve önce başarısız olan panel geçişi Chromium/Firefox'ta geçti. İlk E2E denemesinde yerel Firefox cache executable'ı yoktu; ayrıca Chromium panel geçişi başarısızdı. Bu denemeye “tam geçti” denmez. Firefox gerçek görev browser runtime'ına yönlendirildi ve route hatası giderildi; timeout yükseltilmedi.

## Riskler ve sonraki tur

Three.js dinamik chunk yaklaşık 567,5kB / 145,2kB gzip; Vite 500kB uyarısı saklanıyor. Sahne lazy/opsiyoneldir; bundle uyarısı eşiği artırılmadı. Yazılımsal WebGL QA fiziksel cihaz FPS/termal ölçümü yerine geçmez. Yerel WebKit sistem kitaplığı eksik olduğundan Safari doğrulaması yapılmış sayılmaz.

Yerel migration status PostgreSQL'e bağlanamıyor; pending dosya sayısı üretim migration durumunu kanıtlamaz. Bu tur schema değişikliği yoktur. Güvenlik başlıkları, yetki/CSRF/Redis ve önceki sunucu kontrollü istatistik düzeltmeleri korunur; bağımlılık audit'i ve yayın readiness'i ayrıca doğrulanır. Üretimde saldırı veya veri değiştiren güvenlik testi yapılmaz.

Sonraki yüksek etkili işler: fiziksel mobil GPU/enerji ölçümü, gerçek ziyaretçi CWV ve pilot dönüşüm verisiyle tasarım kararlarını değerlendirmek; görsel kaliteyi artırmak için yeni teknik etiket veya dekoratif içerik eklememek.

## Son kaynak kontrolü

Güncellenmiş public landing ve hareket E2E testleri: **24/24 geçti** (Chromium/Firefox, 1,8 dakika). Eski sürüm rozeti expectation'ları artık metadata ve görünür rozetin yokluğunu kontrol eder. İki browser'da oyuncu paneline geçiş ve tüm public akışlar son kaynakta doğrulandı. Önceki 130 başarılı akışla birlikte tüm seçili E2E senaryoları kapsandı; tek bir taze 132/132 koşusu iddiası yapılmıyor.

Kod, doğrulanmış mevcut GitHub CI → Deploy VPS süreciyle yayımlanacak; dağıtım sonucunun gerçek readiness revision ve iki canlı sayfanın read-only QA kanıtı görev çıktı raporunda ayrıca kaydedilir. Yayın gerçekleşmeden “canlıda” denmez.
