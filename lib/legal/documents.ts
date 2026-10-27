/** Plain content shared by the accessible React reader and the no-JavaScript HTML build. */
export type LegalPath = '/kosullar' | '/iade' | '/gizlilik' | '/cerezler';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  links?: readonly { href: string; label: string }[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalPath, LegalDocument> = {
  '/kosullar': {
    title: 'Kullanım Koşulları',
    intro:
      'CafeDuo hesabını, oyunları ve kafe hizmetlerini kullanırken geçerli kurallar. Kişisel verilerin işlenmesi hakkında ayrı KVKK aydınlatma metnini de inceleyebilirsin.',
    sections: [
      {
        id: 'hizmet',
        title: 'Hizmet ve taraflar',
        paragraphs: [
          'CafeDuo, Emin Emre tarafından işletilen, katılımcı kafelerde oyun oynamayı ve puanları kafenin sunduğu ödüllerde kullanmayı sağlayan bir platformdur. Hizmet sağlayıcının iletişim bilgileri bu sayfanın sonunda yer alır.',
          'Oyuncu üyeliği ve oyunlara katılım ücretsizdir. Kafelerin sunduğu yiyecek ve içecekler ile kafe işletmesine yönelik yazılım aboneliği farklı hizmetlerdir. Bu koşullar CafeDuo kullanımını düzenler; bir ödeme yapıldığında ödeme ekranındaki satıcı ve sipariş koşulları ayrıca geçerlidir.',
        ],
      },
      {
        id: 'hesap',
        title: 'Hesap ve adil kullanım',
        items: [
          'Hesap bilgilerinin doğru olmasından ve şifreni korumaktan sorumlusun. Başkasının hesabını kullanamaz, hesabını satamazsın.',
          'Hile, otomatik puan toplama, konum veya masa doğrulamasını aşma, sahte hesaplarla ödül kazanma ve hizmetin güvenliğini bozma yasaktır.',
          'Paylaştığın kullanıcı adı ve diğer içerikler hukuka ve başkalarının haklarına uygun olmalıdır. Kişisel veya özel nitelikli bilgilerini herkese açık alanlara yazma.',
          'Sözleşme kurmak için gereken hukuki ehliyete sahip olmalısın. Yasal temsilci onayı gereken durumlarda bu onay olmadan hesap açılmamalıdır.',
        ],
      },
      {
        id: 'puan',
        title: 'Puanlar, oyunlar ve ödüller',
        paragraphs: [
          'Puanlar yalnız CafeDuo içindeki oyun ve ödül sisteminde kullanılır; para veya elektronik para değildir. Puan satın alınamaz, nakde çevrilemez ve platform dışında satılamaz. Puanlar için sabit bir Türk lirası karşılığı veya yatırım getirisi taahhüdü yoktur.',
          'Maçta seçilen puan miktarı, oyun kuralları uyarınca kazanan ve kaybedenin puanını etkileyebilir. Kullanıcılar arasında serbest puan gönderimi yoktur; maç sonucunu ve puan değişimini sunucu belirler. Bağlantı sorunu hâlinde sunucudaki geçerli sonuç esas alınır; hatalı işlem itirazları destek adresine iletilebilir.',
          'Ödülün içeriği, gerekli puan, geçerlilik ve kullanım koşulları ilgili kafenin ödül kaydında gösterilir. Yiyecek ve içeceklerin hazırlanması ve sunumu ilgili kafenin sorumluluğundadır. Stok veya kullanım sorunu yaşarsan kafe yetkilisine ve bize ulaşabilirsin; bu düzenleme kanuni haklarını ortadan kaldırmaz.',
          'Günlük ödül ve benzeri özelliklerin sonuçları kullanılan oyun kuralına göre belirlenir. Her kullanımda belirli bir ödül veya kazanç garanti edilmez. Kampanyalara ait özel koşullar, ilgili kampanyada ayrıca gösterilir.',
        ],
      },
      {
        id: 'abonelik',
        title: 'Kafe abonelikleri ve deneme',
        paragraphs: [
          'Kafe aboneliği işletmelerin ticari veya mesleki kullanımı içindir. Ücretli çevrim içi abonelik henüz kullanıma açılmamıştır; bu sayfa tek başına sipariş oluşturmaz veya kartından ücret alınmasına izin vermez.',
          'Ücretli hizmet açıldığında planlanan Pro ücreti aylık ₺800 + KDV veya yıllık ₺6.400 + KDV olacaktır. Vergiler dahil toplam bedel, dönem ve varsa yenileme koşulları ödeme öncesinde ayrıca gösterilir. Bir fiyat değişikliği daha önce ödenmiş dönem için geriye dönük uygulanmaz.',
          'Yeni kafe başvuruları yönetici değerlendirmesine tabidir. Planlanan 30 günlük deneme, kafe onaylandığında başlar. Deneme onayı tek başına ücretli aboneliğe dönüşmez; ücretlendirme için ayrıca ödeme işlemi gerekir.',
          'Abonelik etkinleştirildiğinde iptal gelecek dönem yenilemesini durdurur; ödenmiş dönemin sonuna kadar erişim sürer. Ödemesizlikte yeni ödül ve turnuva oluşturma kısıtlanabilir; oyuncuların oyun, check-in ve mevcut kupon kullanımı sırf bu nedenle kapatılmaz. Güvenlik veya hukuka aykırı kullanım nedeniyle ayrı bir askıya alma işlemi uygulanabilir.',
        ],
      },
      {
        id: 'odeme',
        title: 'Paddle üzerinden yapılacak ödemeler',
        paragraphs: [
          'Ücretli ödeme hizmeti etkinleştirildiğinde, Paddle üzerinden verilen siparişlerin çevrim içi satıcısı ve Merchant of Record’u Paddle.com olacaktır. Paddle ödeme tahsilatı, ödeme belgesi ve ödeme/iade taleplerini yürütür; CafeDuo yazılım hizmetini ve ürün desteğini sunar. Kart bilgilerinin tamamı CafeDuo tarafından alınmaz veya saklanmaz.',
          'Paddle ile kurulacak satın alma ilişkisine Paddle Alıcı Koşulları ve İade Politikası uygulanır. Bu metin CafeDuo veya Paddle için henüz gerçekleşmemiş bir satış, hesap onayı ya da koşulsuz iade garantisi beyanı değildir.',
        ],
        links: [
          { href: 'https://www.paddle.com/legal/buyer-terms', label: 'Paddle Alıcı Koşulları' },
          { href: 'https://www.paddle.com/legal/refund-policy', label: 'Paddle İade Politikası' },
          { href: '/iade', label: 'CafeDuo iade ve iptal açıklaması' },
        ],
      },
      {
        id: 'sona-erme',
        title: 'Hizmet değişiklikleri ve hesabın kapanması',
        paragraphs: [
          'Güvenlik, hile veya hukuka aykırılık şüphesi varsa ilgili hesap veya özellik, sorun incelenirken ölçülü biçimde kısıtlanabilir. Mümkün ve hukuken izin verilen durumlarda gerekçesi bildirilir ve itiraz olanağı sağlanır. Hesap kapatma ve kişisel veri talepleri iletişim adresine iletilebilir.',
          'Hizmette bakım veya kesinti olabilir; kesintisiz ve hatasız çalışma taahhüdü verilmez. Bununla birlikte kast, ağır kusur ve kanunen sınırlandırılamayan sorumluluklar ile ayıplı hizmete ilişkin zorunlu haklar saklıdır.',
          'Esaslı koşul değişiklikleri yürürlüğe girmeden önce uygun kanaldan bildirilir; gerektiğinde yeni kabul istenir. Önceden doğmuş haklar geriye dönük ortadan kaldırılmaz. Bir bilgilendirme bandını kapatmak tek başına ödeme, pazarlama veya kişisel veri işlemeye açık rıza anlamına gelmez.',
        ],
      },
      {
        id: 'uyusmazlik',
        title: 'Başvuru ve uyuşmazlıklar',
        paragraphs: [
          'CafeDuo hizmetiyle ilgili taleplerini aşağıdaki iletişim kanallarına gönderebilirsin. Bu kullanım ilişkisine Türk hukuku uygulanır; kanunen yetkili mahkemeler ve diğer başvuru mercileri saklıdır. Tüketici sıfatına sahip kişilerin tüketici hakem heyetine veya tüketici mahkemesine başvuru hakları sınırlandırılmaz.',
          'Paddle ile kurulan ayrı satın alma ilişkisine ilişkin hukuk ve yetki hükümleri Paddle koşullarında açıklanır; uygulanması zorunlu haklar bu metinle bertaraf edilmez.',
        ],
      },
    ],
  },
  '/iade': {
    title: 'İade ve İptal Politikası',
    intro:
      'Oyuncu üyeliği ücretsizdir. Aşağıdaki ödeme açıklamaları, ücretli kafe aboneliği etkinleştirildiğinde Paddle üzerinden yapılacak işlemler içindir.',
    sections: [
      {
        id: 'kapsam',
        title: 'Kapsam ve satıcı',
        paragraphs: [
          'Çevrim içi ücretli abonelik henüz kullanıma açık değildir. Paddle üzerinden satış başladığında ödeme işleminin satıcısı (Merchant of Record) Paddle.com, yazılım hizmetinin sağlayıcısı Emin Emre olacaktır. Ücretsiz oyuncu üyeliği veya oyun puanı için ödeme alınmadığından bunlara ilişkin ücret iadesi işlemi bulunmaz.',
          'Kafelerin ticari veya mesleki amaçla yaptığı alımlar ile tüketici işlemleri aynı değildir. Tüketici sıfatı ve uygulanacak kanuni haklar işlemin niteliğine göre belirlenir; bir işletme alımı için otomatik tüketici cayma hakkı vaat edilmez.',
        ],
      },
      {
        id: 'iptal',
        title: 'Abonelik iptali',
        paragraphs: [
          'Ücretli abonelik açıldığında satın alma e-postasındaki Paddle müşteri portalı veya Paddle desteği üzerinden iptal talebi iletilebilir. İptal normal olarak mevcut fatura döneminin sonunda geçerli olur ve sonraki yenilemeyi durdurur.',
          'İptal ile iade farklı işlemlerdir. Dönem sonu iptali kendiliğinden kullanılmayan günler için orantılı iade doğurmaz; kanuni haklar ve Paddle tarafından onaylanan iadeler saklıdır. Ücretsiz denemeye katılım tek başına ücret tahsilatı yetkisi vermez.',
        ],
        links: [{ href: 'https://paddle.net/', label: 'Paddle ödeme ve abonelik desteği' }],
      },
      {
        id: 'iade-talebi',
        title: 'İade talebi ve 14 günlük süre',
        paragraphs: [
          'İlk ödeme veya yenilemeyle ilgili iade talebini mümkün olduğunca erken Paddle desteğine ilet. Paddle’ın İade Politikası, işlem tarihinden itibaren 14 gün içinde yapılan talepler için takdire bağlı iade değerlendirmesi öngörür; bu süre içinde başvurmak tek başına iadenin kesin kabul edileceği anlamına gelmez.',
          'Zorunlu tüketici hükümlerinden doğan cayma, ayıplı hizmet, mükerrer veya yetkisiz tahsilat gibi haklar ayrıca değerlendirilir. Dijital hizmetin erken ifasına ilişkin istisnalar ancak ilgili hukukun aradığı bilgilendirme ve onay koşulları sağlanmışsa uygulanabilir. Bu sayfa cayma hakkından peşinen feragat beyanı değildir.',
          'İlk ödeme ve yenilemeler hakkında kanuni hakları kaldıran genel bir “iade yapılmaz” kuralı uygulanmaz. Hak kazandığın bir iade, mümkünse ilk ödeme yöntemine Paddle tarafından yapılır; banka ve ödeme yöntemi nedeniyle hesaba yansıma zamanı değişebilir.',
        ],
        links: [
          {
            href: 'https://www.paddle.com/legal/refund-policy',
            label: 'Paddle’ın güncel İade Politikası',
          },
        ],
      },
      {
        id: 'basvuru',
        title: 'Nasıl başvurabilirsin?',
        paragraphs: [
          'Ödeme e-postası, işlem numarası, işlem tarihi ve talebinin kısa açıklamasıyla paddle.net üzerinden başvurabilirsin. Ürünle ilgili destek veya talebin yönlendirilmesi için cafeduotr@gmail.com adresine de yazabilirsin. Tam kart numarası, kart güvenlik kodu veya şifre gönderme.',
          'Bir destek başvurusu kanuni başvuru veya ödeme itirazı hakkını kullanmana engel değildir. CafeDuo’da kazanılan yiyecek/içecek ödülünün sunumuna ilişkin sorunlar ilgili kafe ve CafeDuo desteğiyle ayrıca değerlendirilir.',
        ],
      },
    ],
  },
  '/gizlilik': {
    title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
    intro:
      'Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi kapsamında kişisel verilerinin işlenmesi hakkında bilgi verir. Bir açık rıza metni değildir; kullanım koşullarının kabulünden ayrıdır.',
    sections: [
      {
        id: 'veri-sorumlusu',
        title: 'Veri Sorumlusu',
        paragraphs: [
          'CafeDuo hizmetinde işleme amaç ve vasıtalarını belirleyen veri sorumlusu Emin Emre’dir. E-posta ve yazışma adresi bu sayfanın sonundadır. Kafelerin kendi müşteri işlemleri ve Paddle’ın kendi ödeme işlemleri bakımından ilgili kuruluşların ayrı aydınlatmaları da geçerlidir.',
        ],
      },
      {
        id: 'amac-dayanak',
        title: 'İşlenen veriler, amaçlar ve hukuki sebepler',
        items: [
          'Üyelik ve oturum: kullanıcı adı, e-posta, şifre özeti, hesap rolü ve doğrulama bilgileri; hesabı oluşturma, giriş, e-posta doğrulama ve şifre yenileme için işlenir (KVKK m.5/2-c, sözleşmenin kurulması veya ifası). Şifreler düz metin yerine bcrypt özeti olarak saklanır.',
          'Profil, oyun ve ödül: paylaşılan bölüm/avatar, oyun katılımı, hamle ve sonuçlar, puan, kazanma sayısı, ödül ve kupon kayıtları; eşleştirme, oyun kuralları, sıralama ve ödül kullanımı için işlenir (m.5/2-c).',
          'Check-in: seçilen kafe ve masa bilgisi; aynı kafedeki oyuncularla eşleşme ve kafe doğrulaması için işlenir (m.5/2-c). Cihaz konumu ve doğruluk bilgisi konumla check-in sırasında mesafe kontrolüne alınır; check-in kaydına cihaz koordinatları yazılmaz. Uygun durumlarda masa doğrulama kodu alternatif olarak kullanılabilir.',
          'Güvenlik ve hata tanılama: IP adresi, istek/cihaz bilgileri, zaman damgaları ve hata kayıtları; kötüye kullanımı önleme, erişim güvenliği ve arıza giderme amacıyla, temel hak ve özgürlüklere zarar vermemek kaydıyla meşru menfaat için zorunlu olduğu ölçüde işlenir (m.5/2-f).',
          'Destek, hukuki talepler ve onay kayıtları: başvuru içeriği, ilgili hesap ve sözleşme kabul sürümü/zamanı; talepleri yanıtlama, hukuki yükümlülükleri yerine getirme ve hakların tesisi, kullanılması veya korunması amacıyla işlenir (duruma göre m.5/2-ç ve m.5/2-e).',
          'Ücretli kafe aboneliği açıldığında işletme iletişim bilgileri, abonelik durumu ve ödeme işlem referansları sözleşmenin ifası ve ilgili hukuki yükümlülükler için işlenir (m.5/2-c ve m.5/2-ç). Tam kart numarası ve güvenlik kodu CafeDuo’ya verilmez; ödeme sağlayıcısının kendi açıklamaları uygulanır.',
        ],
      },
      {
        id: 'toplama',
        title: 'Toplama yöntemi',
        paragraphs: [
          'Veriler kayıt ve profil formları, oyun ve ödül işlemleri, check-in istekleri, zorunlu çerezler ve teknik kayıtlar yoluyla elektronik ortamda; destek veya hak başvurularında ise tarafımıza ilettiğin mesaj ve belgelerden otomatik veya veri kayıt sisteminin parçası olan otomatik olmayan yöntemlerle toplanır. Cihazın konum izni, uygulama içi bilgilendirme ve hukuki işleme şartının yerine geçmez.',
        ],
      },
      {
        id: 'alici',
        title: 'Alıcı grupları ve aktarım amaçları',
        items: [
          'Diğer oyuncular: eşleştirme, oyun ve sıralama ekranlarında kullanıcı adı, avatar, puan, oyun sonucu ve görünür profil bilgileri paylaşılır. Herkese açık alanlara yazdığın bilgilerin başkalarınca görülebileceğini dikkate al.',
          'İlgili kafe ve yetkili personeli: kafe yönetimi, katılım, ödül ve kupon doğrulaması için gerekli hesap/işlem bilgilerine erişebilir.',
          'Altyapı ve hizmet sağlayıcıları: barındırma, e-posta gönderimi ve hata takibi için gerekli veriler işlenir. Resend’e işlem e-postası alıcısı ve mesaj içeriği; Sentry’ye hata tanılama verileri iletilebilir. Destek adresi Gmail (Google) altyapısındadır; gönderdiğin destek mesajları burada işlenir.',
          'Harita sağlayıcısı: kafe yönetimindeki harita açıldığında OpenStreetMap döşemeleri için doğrudan tarayıcı isteği yapılır; sağlayıcı IP/istek bilgilerini ve istenen harita bölgesini alabilir.',
          'Paddle: yalnız ücretli ödeme sistemi açıldığında, abonelik ve ödeme işlemleri için gerekli müşteri ve işlem bilgileri işlenecektir. Kart verileri Paddle veya onun ödeme hizmeti sağlayıcılarınca işlenir.',
          'Yetkili kamu kurumları ve yargı mercileri: geçerli yasal talep veya hukuki yükümlülük kapsamında gerekli veriler aktarılabilir (m.5/2-ç veya m.5/2-e; yurt içi aktarımlarda m.8).',
        ],
      },
      {
        id: 'yurt-disi',
        title: 'Yurt dışına aktarım hakkında',
        paragraphs: [
          'Resend, Sentry, Google ve kullanılan harita altyapısı hizmetleri nedeniyle kişisel veriler yurt dışında işlenebilir. Bir hizmetin Avrupa bölgesinde çalışması veya genel bir veri işleme sözleşmesi sunması, tek başına KVKK m.9 koşullarının sağlandığını göstermez.',
          'Bu aydınlatma metnini okuman veya kullanım koşullarını kabul etmen yurt dışına aktarıma açık rıza olarak değerlendirilmez. Aktarım için KVKK m.9 kapsamında geçerli bir aktarım şartı ve gerekiyorsa uygun güvence ayrıca bulunmalıdır. İmzalanmış bir Türk standart sözleşmesinin veya Kurul onayının mevcut olduğu bu metinle iddia edilmemektedir. Kullanılan alıcılar ve aktarımlara ilişkin bilgi talebini aşağıdaki kanallardan iletebilirsin.',
        ],
      },
      {
        id: 'saklama',
        title: 'Saklama ve silme',
        paragraphs: [
          'Hesap ve hizmet kayıtları, ilgili işleme amacı ve varsa uygulanması zorunlu saklama süresiyle sınırlı tutulmalıdır. Bir hakkın korunması için gerekli kayıtlar yalnız o amaçla ve gerekli süre boyunca muhafaza edilebilir; bu durum bütün hesabın süresiz saklanması anlamına gelmez.',
          'Hesap kapatma ve silme talebini e-posta veya yazışma adresimize iletebilirsin; uygulama içinde kendi kendine hesap silme özelliği yoktur. Talebin en geç 30 gün içinde sonuçlandırılır. Bu, bütün verilerin ve yedeklerin koşulsuz olarak 30 gün içinde silindiği taahhüdü değildir: kanuni saklama zorunluluğu veya hakların korunması ihtiyacı varsa gerekçesi yanıtta açıklanır. İşleme şartları ortadan kalkan veriler silinir, yok edilir veya anonim hâle getirilir.',
        ],
      },
      {
        id: 'haklar',
        title: 'KVKK Kapsamındaki Hakların',
        paragraphs: ['KVKK m.11 kapsamında aşağıdaki haklara sahipsin:'],
        items: [
          'Kişisel verilerinin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi isteme.',
          'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.',
          'Eksik veya yanlış verilerin düzeltilmesini; m.7 şartları oluştuğunda silinmesini veya yok edilmesini isteme.',
          'Düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme.',
          'Münhasıran otomatik analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme; kanuna aykırı işleme nedeniyle zarara uğrarsan zararın giderilmesini talep etme.',
        ],
      },
      {
        id: 'basvuru',
        title: 'Başvuru ve yanıt',
        paragraphs: [
          'Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca yazılı olarak aşağıdaki adrese veya bize daha önce bildirdiğin ve sistemimizde kayıtlı e-posta adresinden cafeduotr@gmail.com adresine başvurabilirsin. Diğer kanuni başvuru yöntemleri saklıdır.',
          'Başvuruda adını, soyadını, tebligata esas adresini, talebini ve Tebliğ’in gerektirdiği kimlik bilgilerini belirt; varsa ilgili belgeleri ekle. Yazılı başvurular imzalanmalıdır. Şifre veya kart bilgisi gönderme. Kimlik doğrulaması talebin niteliğiyle orantılı yapılır.',
          'Başvurular en kısa sürede ve en geç 30 gün içinde kural olarak ücretsiz sonuçlandırılır. İşlem ayrıca maliyet gerektirirse yalnız Kurul tarifesine uygun ücret istenebilir; hata bizden kaynaklanmışsa ücret iade edilir. Kanuni şartlarda Kurula şikâyet ve diğer başvuru hakların saklıdır.',
        ],
      },
      {
        id: 'cerez',
        title: 'Çerez Politikası',
        paragraphs: [
          'Oturum ve güvenlik için zorunlu çerezler ile tarayıcı deposu kullanılır. Reklam veya ürün analitiği çerezi kullanılmaz. Amaç, süre ve kontrol seçenekleri ayrı çerez politikasında açıklanır.',
        ],
        links: [{ href: '/cerezler', label: 'Çerez politikası' }],
      },
    ],
  },
  '/cerezler': {
    title: 'Çerez Politikası',
    intro:
      'CafeDuo’nun oturum ve güvenlik çerezleri ile cihazındaki yerel depolama kullanımına ilişkin açıklama. Reklam veya ürün analitiği çerezi kullanılmaz.',
    sections: [
      {
        id: 'cerezler',
        title: 'Kullanılan çerezler',
        items: [
          'auth_token — birinci taraf oturum çerezi. Giriş yapmış kullanıcıyı tanımak için kullanılır. HttpOnly’dir; tarayıcı JavaScript’i okuyamaz. Azami ömrü 7 gündür; çıkışta temizlenir.',
          'csrf_token — birinci taraf güvenlik çerezi. İsteklerin aynı oturumdan geldiğini doğrulayarak sahte istekleri önlemeye yardımcı olur. Azami ömrü 7 gündür; yenilenebilir ve çıkışta temizlenir. JavaScript tarafından okunması güvenlik protokolünün parçasıdır.',
        ],
      },
      {
        id: 'dayanak',
        title: 'Neden kullanılıyor?',
        paragraphs: [
          'Talep ettiğin oturum hizmetini sunmak ve hizmetin güvenliğini sağlamak için zorunlu olan çerezler, amaca göre sözleşmenin ifası (KVKK m.5/2-c) veya temel haklarına zarar vermemek kaydıyla meşru menfaat (m.5/2-f) kapsamında kullanılır. Bunlar için ayrı bir reklam/analitik çerezi rızası istenmez. Bilgilendirme bandını kapatmak veri işlemeye açık rıza değildir.',
          'İleride zorunlu olmayan çerezler eklenecekse, gerekli bilgilendirme ve uygun tercih mekanizması bunlar kullanılmadan önce ayrıca sunulmalıdır. Bu metin gelecekteki bütün çerezlere toplu izin vermez.',
        ],
      },
      {
        id: 'depo',
        title: 'Yerel depolama ve oturum deposu',
        items: [
          'cafe_user: arayüzde hesabını göstermek için kullanılan profil/oturum görünümü. Kimlik doğrulama şifresi değildir; erişim yetkisini sunucu kontrol eder. Çıkışta temizlenir.',
          'last_cafe_id ve last_table_number: önceki kafe ve masa seçimini hatırlamak için kullanılır; yeni seçimle güncellenir veya tarayıcı verileri silinince kaldırılır.',
          'Çerez bildiriminin kapatıldığı bilgisi: bandı aynı tarayıcıda her açılışta göstermemek içindir. Eski sürümlerdeki cookie_consent değeri bir pazarlama veya yurt dışı aktarım izni sayılmaz.',
          'Oturumluk check-in ve bant kapatma bilgileri: ilgili ekranın/oturumun durumunu korur. sessionStorage kayıtları sekme oturumu kapanınca silinir; localStorage kayıtları uygulama temizleyene veya tarayıcı verilerini silene kadar kalabilir.',
          'PWA önbelleği: uygulama dosyalarının yüklenmesini hızlandırmak için cihazda tutulabilir. Tarayıcının site verileri bölümünden silinebilir; bu önbellek bir reklam takip çerezi değildir.',
        ],
      },
      {
        id: 'kontrol',
        title: 'Kontrol ve başvuru',
        paragraphs: [
          'Çerezleri ve site verilerini tarayıcı ayarlarından silebilir veya engelleyebilirsin. Zorunlu oturum ve güvenlik çerezleri engellenirse giriş yapma ve hesabını kullanma işlevleri çalışmayabilir; bunun nedeni bu işlevlerin teknik gereksinimidir, bir reklam rızasını reddetmen değildir.',
          'İşlenen kişisel veriler, alıcılar, yurt dışı aktarım ve KVKK haklarına ilişkin ayrıntılar ayrı aydınlatma metnindedir. İletişim bilgileri bu sayfanın sonunda yer alır.',
        ],
        links: [{ href: '/gizlilik', label: 'KVKK aydınlatma metni' }],
      },
    ],
  },
};
