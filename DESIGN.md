# CafeDuo — Seramik oyun dünyası

## Tasarım kaynakları

Stitch CLI 0.11.0 ile gerçek Google OAuth oturumu kullanılarak iki yeni desktop ekran üretildi. Global proje binding veya batch upload yapılmadı. Proje bağlantısı CLI `stitch url project` çıktısından alındı:

- [CafeDuo tasarım projesi](https://stitch.google.com/projects/17019580352055421782)
- Oyuncu ekranı: `dc5a409b8b85444e8fc061d29a550745`
- Kafe sahipleri ekranı: `dd1a4ee117f8400ba5b0941686ccd409`

Stitch, sanat yönetimi ve sayfa ritmi için referanstır. Ürettiği HTML'deki CDN, inline script, uydurma sayaç, doğrulanmamış ürün özelliği ve dekoratif arayüz metinleri üretime aktarılmaz. Uygulamanın gerçek React akışları, semantik kontrolleri ve yerel WebGL sahnesi korunur.

## Görsel dil

Krem `#fff9ef`, kobalt `#315bd5`, seramik pembe `#ed82b4`; ikincil yüzeylerde açık mavi `#dce6fa` ve sıcak kum `#f3eddf`. Büyük DM Sans başlıkları, sınırlı Fraunces italik vurgu ve yumuşak yüzeyler kullanılır. Yazı tipleri yereldir. Öğrenci ve işletme sayfaları aynı navigasyon, obje kompozisyonu, CTA ve spacing ritmini paylaşır.

Hero'da gerçek perspektifli fincan, satranç atı ve jeton vardır. İllüstrasyonu kartlarla, teknik rozetlerle veya sahte istatistiklerle doldurmayın. Ürün açıklamaları ve gerekli aksiyonlar açık kalır. Hareket, prototip, rendering veya tasarım altyapısına dair kullanıcıya görünen etiket eklemeyin. Pause ve sahne kontrolleri yalnızca ikon gösterir; anlamları `aria-label` üzerinden erişilebilir kalır. Sistem reduced-motion tercihi önceliklidir.

## Etkileşim ve performans

- Native buton/link, görünür focus ve en az 44px dokunma hedefi.
- Hareket tercihi aynı sekmede korunur; gizli sekme ve ekran dışındaki sahne durur.
- Sahne yalnızca görünürken lazy yüklenir. Geç import, ayrılınmış route'ta GPU başlatmaz.
- En fazla 30fps ve 1,5 DPR; yerel materyal/geometry, harici model veya texture yok.
- WebGL yoksa statik illüstrasyon; essential content ve CTA her zaman HTML'de.
- Canvas ölçüleri yüklenmeden önce sabittir. Route loading alanı footer'ı ilk viewport dışında tutar.
- 320px telefon, yatay telefon, tablet ve desktop birlikte değerlendirilir.

## Sayfa yolculukları

Oyuncu: net katıl/giriş CTA → bağımsız satranç demosu → hesap/kafe doğrulama/eşleşme akışı → üç oyun → son CTA.

Kafe: “Kahve sizden. Oyun bizden.” → müşteri oyun/ödül kompozisyonu → ilk iki kafe için ücretsiz pilot koşulları → müşteri akışı ve faydalar → mevcut fiyatlandırma → FAQ → WhatsApp/e-posta. Mevcut fiyat ve pilot koşulları tasarım üretimi tarafından değiştirilmez.
