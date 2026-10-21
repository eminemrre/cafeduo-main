# Bağımsız inceleme: düzeltmeler ve açık yayın engelleri

Bu belge #74–#80 zincirinden sonraki takip düzeltmesini kapsar. Önceki test
başarıları tüm plan koşullarının sağlandığı anlamına gelmiyordu. **İkinci inceleme
olmadan merge/deploy yok; üretimde hiçbir migration/transition çalıştırılmadı.**

## 1. Joker gizliliği

Joker seçimleri yalnız `game_private_state.jokers[actor]` içinde tutulur. Ortak
`gameState`, socket, lobby ve geçmiş serializer'ı `hiddenOptions` kabul etmez;
önceden kalmış hatalı public alanlar da filtrelenir. Kimliği doğrulanmış action
ve GET yanıtı, ayrı allowlist `actorView.joker` alanına yalnız kendi oyuncusunun
güncel tur jokerini ekler. İstemci aynı roundId için bu alanı kullanır; socket
verisi yeni joker seçimleri üretemez. Diğer oyuncu aynı yanlış seçenekleri ancak
kendi joker hakkını harcayarak alabilir.

## 2. Deadline ve catch-up

Motorlar geç gelen okuyucunun `now` değerinden yeni tur süresi başlatmaz. Tur
timeout'u eski `endsAt`, reveal sonu da bir sonraki turun başlangıcıdır. İki
eylemle erken kapanış en geç kabul edilen sunucu receive-time'a dayanır. Bir
çağrıda en fazla maçın tur sayısı kadar open/reveal çifti işlenir. Bellek işi de
aynı oyun kilidini ve settlement fonksiyonunu kullanır; oyuncular yokken maçı
bitirir. **Bellek modu process restart'ında kalıcı depolama sağlamaz**; DB'siz
rekabetçi üretim için dayanıklılık iddiasında bulunulmuyor.

## 3. Receive-time ve AÇIK sıralama engeli

HTTP action handler girişinde sunucu zamanı alınır; pool, BEGIN, row lock ve
bellek kuyruğu beklemesi skor zamanını değiştirmez. İstemci timestamp'i yoktur.
İşlem sırasında tur henüz açıksa bu receive-time kullanılır. Tur önceden
kapanmışsa yeniden açılmaz; başka tura eski timestamp ile puan verilmez.

**ENGEL:** başka instance'taki worker/GET action satır kilidini önce alıp turu
kalıcı olarak kapatmışsa, deadline öncesinde ulaşmış ama hâlâ kuyruktaki action
reddedilebilir. Bu güvenli ret, eksiksiz receive-time sıralaması değildir. Tüm
instance'lar için kalıcı ingress kuyruğu/sıralama protokolü tasarlanmadan bu
garanti verilemez. Eski durumu geri açmak veya istemci saatine güvenmek çözüm
olarak uygulanmadı. Yeni ürün kararı veya tolerans eklenmedi.

## 4. Gerçek ağ RTT ölçümü ve AÇIK oynanabilirlik engeli

Yeni `@rtt` harness gerçek tarayıcı GET/action isteklerini yarım RTT upstream,
yarım RTT downstream bekletir, +700 ms istemci saat sapması uygular. CSS
nişangah ortadayken gerçek tarayıcı mouse click'iyle UI düğmesine basılır;
görünen pozisyon ve resmi makbuz karşılaştırılır. Action istek gövdesi hâlâ
yalnız actionId/roundId/type içerir. Saat kestirimi dört timestamp ile server
işlem süresini çıkarır; socket teslim süresi clock kalibrasyonunu bozmaz.
Asimetrik ağlarda yarı yol farkı belirsizliği kalır.

Yerel Chromium, bir örnek/RTT (istatistiksel benchmark değildir):

| Yapay RTT | Ölçülen GET / action RTT | Görünen puan | Resmi puan | Ingress - click |
| --------- | ------------------------ | ------------ | ---------- | --------------- |
| 50 ms     | 74 / 70 ms               | 3            | 2          | 60 ms           |
| 150 ms    | 165 / 166 ms             | 3            | 1          | 96 ms           |
| 300 ms    | 311 / 317 ms             | 3            | 1          | 173 ms          |

Görünen/gerçek click konumu farkları sırasıyla +2.17, -2.13, +1.35 birimdir.
Her resmi puan, sunucunun giriş zamanı ve ortak trajectory fonksiyonuyla ayrıca
doğrulanır. Ham JSON ölçümleri Playwright attachment'ıdır.

**ENGEL:** merkezde görünen 3 puanlık atış resmi olarak 1–2 puana düşebiliyor.
Saat kalibrasyonu uplink gecikmesini ortadan kaldırmaz. Receipt-time ve mevcut
hız/eşikler korunmuştur; oynanabilirlik tamam veya aktivasyon onaylı değildir.
Ölçüm testinin yeşil olması ürün kabulü değil, ölçümün/puan hesabının doğruluğudur.

**2026-10-21 zorluk kararı (kullanıcı):** bölgeler ±4/±10/±18 yerine ±2.5/±6/±12;
trajectory sunucu tohumlu iki dalgalı ritimle ortalama hız etrafında hızlanıp
yavaşlar (anlık hız ortalamanın 0.4–1.6 katı). Yukarıdaki tablo eski bölgelerle
ölçüldü. Dar bölge ve tepe hızı aynı gecikmeyi daha çok puana çevirir: bu karar
oynanabilirlik engelini büyütür, kapatmaz. Gecikme telafisi veya ürün kabulü
olmadan aktivasyon önerilmez.

## 5. Dokploy / migration ÖNCE koşulu

API Compose ortamı `GAME_ENGINE_V2_ENABLED=${GAME_ENGINE_V2_ENABLED:-false}`
değerini kapsayıcıya geçirir. Panelde tanımlamak ancak Compose bu değişkeni
kullandığında etkilidir; env değişince API'nin yeniden oluşturulması gerekir.
Bu oturumda Docker kurulmadı ve kapsayıcı çalıştırılmadı.

**Flag=false schema uyumluluğu sağlamaz:** GET/satranç/list yolları da yeni
kolonu okuyabilir. Bu nedenle sıra aşağıdaki gibi, yalnız ayrıca onaylı bakım
penceresinde operatör tarafından uygulanmalıdır:

1. Herhangi bir merge ÖNCESİ Dokploy auto-deploy/webhook'u devre dışı bırak;
   bekleyen deploy kuyruğunun boş olduğunu kontrol et. PR zincirini otomatik
   art arda deploy etmek yasaktır. Yeni puanlı maçların kapanacağı bakım
   penceresini duyur. Mevcut üretim revision/env ve backup'ı kaydet.
2. Mevcut DB baseline/migration envanterini salt-okunur incele. Özellikle eski
   `reset_users_keep_admins` migration'ını üretimde replay etme.
3. İncelenmiş artifact'tan **yalnız** additive
   `20261021130000_add_game_private_state.js` migration'ını, node-pg-migrate
   bulunan ayrı onaylı release ortamında çalıştır. Running production image
   devDependencies kurmuyor; bu CLI'nın API kapsayıcısında bulunacağı varsayılamaz.
   Önce aynı baseline'ın disposable kopyasında up/down/up doğrula. Onaysız
   production down/redo yok.
4. `information_schema.columns` ile `games.game_private_state` jsonb kolonunu
   ve migration kaydını doğrula. Hâlen çalışan eski backend bu nullable alanı
   kullanmadığından additive değişiklik eski kodla uyumludur.
5. İkinci inceleme ve tüm kırmızı kapılar çözülmeden PR'ları merge etme. Sonra
   ayrıca izinle zincirin backend/frontend artifact'ını birlikte, **flag=false**
   deploy et; health/readiness/satranç/lobby/Sentry kontrolünü onaylı test
   hesabıyla yap. Eksik zinciri ara deploy'larla etkinleştirme.
6. Legacy iptal dry-run/apply ve flag=true için **ayrı** onay al. Açık receive-time
   ve oynanabilirlik engelleri nedeniyle şu anda aktivasyon önerilmiyor.

**Ek kurulum engeli:** boş disposable DB'de tüm tarihsel `migrate:up` denemesi
`column "token" does not exist` ile başarısız oldu. Yeni game engine migration'ı
değil tarihsel index/bootstrap uyumsuzluğu; sessizce atlanıp tam kurulum başarılı
sayılmadı. Yeni CI engine fixture'ı gerçek PostgreSQL'de yalnız mevcut initial
schema + additive engine migration'ını up/down/up çalıştırır. Bu izole motor
testidir; tüm uygulamanın boş DB kurulumunun kanıtı değildir.

## 6–7. CI ve gerçek PostgreSQL

Kontroller başına HEAD SHA loglanır. V2/advanced hataları artık
`continue-on-error` ile gizlenmez. Takip dalı CI'sında quality/unit/build/audit,
Chromium smoke/v2/RTT ve gerçek PostgreSQL testleri başarısızlıkta kırmızı döner.
Root #74'ün modal retry testi satrançla aynı hata/yeniden-deneme akışını
doğrulamalıdır; maintenance guard testini silmek çözüm değildir.

PostgreSQL paketi gerçek row lock/transaction kullanır: aynı/farklı ID ile
answer/fire eşzamanlılığı, gerçek UPDATE sonrası hata/rollback/retry,
action+deadline job+finish yarışı, ters host/guest iki maçta bakiye kilidi ve
tekrar settlement. Yarış testi güvenli ret ihtimalini açıkça kabul eder; ingress
sıralama engelini gizlemez. Bu testler üretime bağlanmayan disposable fixture'da
çalıştırılır. Tam rollout hâlâ **ENGELLİ**.
