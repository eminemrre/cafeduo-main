export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
}

const RAW_QUIZ_QUESTIONS: QuizQuestion[] = [
  { question: 'Türkiye Cumhuriyeti hangi yılda ilan edildi?', options: ['1919', '1920', '1923', '1938'], answerIndex: 2 },
  { question: 'Ankara hangi bölgededir?', options: ['Ege', 'İç Anadolu', 'Karadeniz', 'Akdeniz'], answerIndex: 1 },
  { question: 'Dünyanın en büyük okyanusu hangisidir?', options: ['Atlas', 'Hint', 'Pasifik', 'Arktik'], answerIndex: 2 },
  { question: 'Bir byte kaç bittir?', options: ['4', '6', '8', '10'], answerIndex: 2 },
  { question: 'Güneşe en yakın gezegen hangisidir?', options: ['Venüs', 'Merkür', 'Mars', 'Dünya'], answerIndex: 1 },
  { question: 'İstanbul Boğazı hangi iki denizi bağlar?', options: ['Ege-Akdeniz', 'Marmara-Karadeniz', 'Karadeniz-Ege', 'Akdeniz-Kızıldeniz'], answerIndex: 1 },
  { question: 'Periyodik tabloda O sembolü hangi elementtir?', options: ['Altın', 'Oksijen', 'Osmiyum', 'Azot'], answerIndex: 1 },
  { question: 'Python hangi tür bir dildir?', options: ['İşletim sistemi', 'Programlama dili', 'Veritabanı', 'Tarayıcı'], answerIndex: 1 },
  { question: 'HTTP neyin kısaltmasıdır?', options: ['HyperText Transfer Protocol', 'High Transfer Text Program', 'Hyper Terminal Text Protocol', 'Host Transfer Tool Protocol'], answerIndex: 0 },
  { question: 'CPU ne yapar?', options: ['Görüntü depolar', 'Veriyi şifreler', 'Komutları işler', 'Ağı yönetir'], answerIndex: 2 },
  { question: 'Fransa’nın başkenti neresidir?', options: ['Marsilya', 'Lyon', 'Paris', 'Nice'], answerIndex: 2 },
  { question: 'Japonya’nın para birimi nedir?', options: ['Won', 'Yen', 'Dolar', 'Rupi'], answerIndex: 1 },
  { question: '3 x 7 sonucu kaçtır?', options: ['18', '20', '21', '24'], answerIndex: 2 },
  { question: 'Kare alanı nasıl hesaplanır?', options: ['a+b', 'a*a', '2a', 'a/2'], answerIndex: 1 },
  { question: 'Pi sayısı yaklaşık kaçtır?', options: ['2.14', '3.14', '4.13', '1.34'], answerIndex: 1 },
  { question: 'Işığın boşluktaki hızı yaklaşık kaç km/s?', options: ['300', '3.000', '30.000', '300.000'], answerIndex: 3 },
  { question: 'Su hangi sıcaklıkta (1 atm) kaynar?', options: ['90°C', '95°C', '100°C', '110°C'], answerIndex: 2 },
  { question: 'Dünya’nın uydusunun adı nedir?', options: ['Titan', 'Ay', 'Europa', 'Phobos'], answerIndex: 1 },
  { question: 'Kıtalar arasında en büyük yüzölçüm hangisidir?', options: ['Afrika', 'Avrupa', 'Asya', 'Güney Amerika'], answerIndex: 2 },
  { question: 'Türkiye’nin plaka kodu 34 hangi ildir?', options: ['Ankara', 'İzmir', 'Bursa', 'İstanbul'], answerIndex: 3 },
  { question: 'ASCII açılımında A harfi neyi temsil eder?', options: ['Advanced', 'American', 'Automatic', 'Applied'], answerIndex: 1 },
  { question: 'Git komutlarında yeni commit oluşturmak için hangisi kullanılır?', options: ['git push', 'git clone', 'git commit', 'git merge'], answerIndex: 2 },
  { question: 'HTML belgesinde başlık etiketi hangisidir?', options: ['<header>', '<title>', '<h1>', '<head>'], answerIndex: 2 },
  { question: 'CSS ne için kullanılır?', options: ['Veritabanı sorgulama', 'Stil ve görünüm', 'Sunucu yönetimi', 'Şifreleme'], answerIndex: 1 },
  { question: 'JavaScript hangi tarafta çalışabilir?', options: ['Sadece istemci', 'Sadece sunucu', 'Her ikisi de', 'Hiçbiri'], answerIndex: 2 },
  { question: 'SQL komutunda veri okumak için hangisi kullanılır?', options: ['INSERT', 'UPDATE', 'DELETE', 'SELECT'], answerIndex: 3 },
  { question: 'JSON formatında anahtarlar nasıl yazılır?', options: ['Tek tırnak', 'Çift tırnak', 'Tırnaksız', 'Parantez içinde'], answerIndex: 1 },
  { question: 'IPv4 adresi kaç bitten oluşur?', options: ['16', '32', '64', '128'], answerIndex: 1 },
  { question: 'HTTPS ile HTTP arasındaki temel fark nedir?', options: ['Port sayısı', 'Şifreli iletişim', 'Tarayıcı türü', 'Paket boyutu'], answerIndex: 1 },
  { question: 'Linux’ta dosya listeleme komutu hangisidir?', options: ['pwd', 'ls', 'cd', 'cat'], answerIndex: 1 },
  { question: '2 üzeri 10 kaçtır?', options: ['512', '1024', '2048', '4096'], answerIndex: 1 },
  { question: 'Türkiye’de en uzun nehir hangisidir?', options: ['Kızılırmak', 'Fırat', 'Dicle', 'Sakarya'], answerIndex: 0 },
  { question: 'Aşağıdakilerden hangisi bir memeli değildir?', options: ['Yunus', 'Yarasa', 'Penguen', 'Balina'], answerIndex: 2 },
  { question: 'Fotosentez için bitkinin en çok ihtiyaç duyduğu gaz hangisidir?', options: ['Azot', 'Oksijen', 'Karbondioksit', 'Helyum'], answerIndex: 2 },
  { question: 'Kan grubu sisteminde evrensel verici hangi gruptur?', options: ['AB+', 'A-', 'O-', 'B+'], answerIndex: 2 },
  { question: 'DNA’nın açılımı nedir?', options: ['Deoksiribonükleik Asit', 'Dinamik Nükleik Asit', 'Doğal Nükleer Ağ', 'Dijital Nükleik Algı'], answerIndex: 0 },
  { question: 'İnsan vücudundaki en büyük organ hangisidir?', options: ['Karaciğer', 'Beyin', 'Deri', 'Akciğer'], answerIndex: 2 },
  { question: 'Bir yılda kaç ay vardır?', options: ['10', '11', '12', '13'], answerIndex: 2 },
  { question: 'Haftanın kaç günü vardır?', options: ['5', '6', '7', '8'], answerIndex: 2 },
  { question: 'Türkiye’nin uluslararası telefon kodu nedir?', options: ['+90', '+91', '+49', '+30'], answerIndex: 0 },
  { question: 'Euro hangi birliğin ortak para birimidir?', options: ['NATO', 'AB', 'ASEAN', 'BRICS'], answerIndex: 1 },
  { question: 'İlk dört asal sayıdan biri olmayan hangisi?', options: ['2', '3', '5', '9'], answerIndex: 3 },
  { question: 'Dik açının ölçüsü kaç derecedir?', options: ['45', '60', '90', '180'], answerIndex: 2 },
  { question: 'Bir üçgenin iç açılar toplamı kaçtır?', options: ['90', '180', '270', '360'], answerIndex: 1 },
  { question: 'Metre birimi neyi ölçer?', options: ['Kütle', 'Uzunluk', 'Sıcaklık', 'Basınç'], answerIndex: 1 },
  { question: 'Kilogram hangi büyüklüğün birimidir?', options: ['Hacim', 'Alan', 'Kütle', 'Hız'], answerIndex: 2 },
  { question: 'Kelvin hangi ölçü birimidir?', options: ['Sıcaklık', 'Zaman', 'Kütle', 'Işık'], answerIndex: 0 },
  { question: 'Elektrik akımının SI birimi nedir?', options: ['Volt', 'Watt', 'Ohm', 'Amper'], answerIndex: 3 },
  { question: 'Ohm neyi ölçer?', options: ['Direnç', 'Güç', 'Akım', 'Gerilim'], answerIndex: 0 },
  { question: 'Watt neyin birimidir?', options: ['Enerji', 'Güç', 'Basınç', 'Hız'], answerIndex: 1 },
  { question: 'Veri sıkıştırmada kayıpsız formata örnek hangisi?', options: ['JPEG', 'PNG', 'MP3', 'MPEG'], answerIndex: 1 },
  { question: 'TCP/IP modelinde HTTP hangi katmanda çalışır?', options: ['Uygulama', 'Ağ Erişim', 'İnternet', 'Fiziksel'], answerIndex: 0 },
  { question: 'SSH protokolü temel olarak ne için kullanılır?', options: ['Uzaktan güvenli bağlantı', 'E-posta gönderimi', 'Video akışı', 'Yedekleme'], answerIndex: 0 },
  { question: 'Docker nedir?', options: ['Veritabanı', 'Container platformu', 'Kod editörü', 'Tarayıcı'], answerIndex: 1 },
  { question: 'REST API’de kaynak silmek için genel yöntem hangisidir?', options: ['GET', 'POST', 'PUT', 'DELETE'], answerIndex: 3 },
  { question: 'JWT ne amaçla kullanılır?', options: ['Görsel sıkıştırma', 'Kimlik doğrulama/oturum taşıma', 'DNS çözümleme', 'Disk bölümleme'], answerIndex: 1 },
  { question: 'Yazılım testinde birim testi neyi hedefler?', options: ['Tüm sistemi', 'Tek fonksiyon/birim davranışını', 'Ağ trafiğini', 'Sunucu kapasitesini'], answerIndex: 1 },
  { question: 'CI/CD açılımındaki CI nedir?', options: ['Central Integration', 'Continuous Integration', 'Code Inspection', 'Container Interface'], answerIndex: 1 },
  { question: 'HTTP 404 ne anlama gelir?', options: ['Sunucu hatası', 'Yetkisiz', 'Bulunamadı', 'Geçersiz istek'], answerIndex: 2 },
  { question: 'HTTP 500 ne anlama gelir?', options: ['İç sunucu hatası', 'Başarılı', 'Yönlendirme', 'Yetkisiz'], answerIndex: 0 },
  { question: 'CDN ne için kullanılır?', options: ['Veritabanı yedekleme', 'İçerik dağıtımını hızlandırma', 'Kod derleme', 'Kimlik yönetimi'], answerIndex: 1 },
  { question: 'Regex hangi amaçla kullanılır?', options: ['Düzenli ifade ile metin eşleştirme', 'Grafik çizimi', 'Video kodlama', 'Ağ yönlendirme'], answerIndex: 0 },
  { question: 'UTF-8 nedir?', options: ['Bir veritabanı', 'Karakter kodlama standardı', 'Bir API tipi', 'Sıkıştırma algoritması'], answerIndex: 1 },
  { question: 'Aşağıdakilerden hangisi NoSQL veritabanıdır?', options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'], answerIndex: 2 },
  { question: 'PostgreSQL hangi tür veritabanıdır?', options: ['Belge tabanlı', 'İlişkisel', 'Anahtar-değer', 'Graf'], answerIndex: 1 },
  { question: 'Bir URL’de domain kısmı hangisidir?', options: ['https', 'index.html', 'example.com', '/api/users'], answerIndex: 2 },
  { question: 'Tarayıcıda F5 tuşu ne yapar?', options: ['Kaydet', 'Yenile', 'Yazdır', 'Sekme kapat'], answerIndex: 1 },
  { question: 'Markdown’da başlık için hangi karakter kullanılır?', options: ['*', '#', '-', '&'], answerIndex: 1 },
  { question: 'UTC neyi ifade eder?', options: ['Uluslararası standart zaman', 'Türkiye saat dilimi', 'Yerel saat', 'Yaz saati'], answerIndex: 0 },
  { question: 'Türkiye hangi saat dilimini kullanır?', options: ['UTC+1', 'UTC+2', 'UTC+3', 'UTC+4'], answerIndex: 2 },
  { question: 'Hangi mevsim Mart-Nisan-Mayıs aylarını kapsar?', options: ['Kış', 'İlkbahar', 'Yaz', 'Sonbahar'], answerIndex: 1 },
  { question: 'Karadeniz Bölgesi en çok hangi iklim tipiyle bilinir?', options: ['Çöl iklimi', 'Karasal iklim', 'Muson iklimi', 'Ilıman yağışlı iklim'], answerIndex: 3 },
  { question: 'Türkiye’nin en kalabalık ili hangisidir?', options: ['Ankara', 'İzmir', 'İstanbul', 'Bursa'], answerIndex: 2 },
  { question: 'Ege Denizi Türkiye’nin hangi tarafındadır?', options: ['Kuzey', 'Doğu', 'Batı', 'Güney'], answerIndex: 2 },
  { question: 'Akdeniz’de yer alan bir ada ülkesi hangisidir?', options: ['İzlanda', 'Japonya', 'Kıbrıs', 'Madagaskar'], answerIndex: 2 },
  { question: 'Sahra Çölü hangi kıtadadır?', options: ['Asya', 'Afrika', 'Avrupa', 'Avustralya'], answerIndex: 1 },
  { question: 'Nil Nehri hangi kıtadadır?', options: ['Afrika', 'Asya', 'Avrupa', 'Kuzey Amerika'], answerIndex: 0 },
  { question: 'Amazon Ormanları en çok hangi ülkede yer alır?', options: ['Kolombiya', 'Peru', 'Brezilya', 'Arjantin'], answerIndex: 2 },
  { question: 'Kutup ayıları doğal olarak en çok hangi bölgede yaşar?', options: ['Antarktika', 'Arktik', 'Sibirya dışı Avrupa', 'Himalayalar'], answerIndex: 1 },
  { question: 'Bir günde kaç saat vardır?', options: ['12', '18', '24', '36'], answerIndex: 2 },
  { question: '1 kilometre kaç metredir?', options: ['10', '100', '500', '1000'], answerIndex: 3 },
  { question: 'Yarım saat kaç dakikadır?', options: ['15', '20', '30', '45'], answerIndex: 2 },
  { question: 'Bir düzinede kaç adet bulunur?', options: ['6', '10', '12', '24'], answerIndex: 2 },
  { question: 'RGB modelinde R harfi neyi temsil eder?', options: ['Red', 'Range', 'Raw', 'Render'], answerIndex: 0 },
  { question: 'Hex renk kodu genellikle hangi karakterle başlar?', options: ['@', '#', '$', '&'], answerIndex: 1 },
  { question: 'Binary sayı sisteminde sadece hangi rakamlar kullanılır?', options: ['0 ve 1', '0-2', '1-9', '0-7'], answerIndex: 0 },
  { question: 'Decimal sayı sistemi tabanı kaçtır?', options: ['2', '8', '10', '16'], answerIndex: 2 },
  { question: 'Hexadecimal sayı sisteminde taban kaçtır?', options: ['8', '10', '12', '16'], answerIndex: 3 },
  { question: 'VPN ne işe yarar?', options: ['Ekran parlaklığını artırır', 'Ağı şifreleyip tüneller', 'Disk hızını artırır', 'E-posta filtreler'], answerIndex: 1 },
  { question: 'Firewall temel olarak ne yapar?', options: ['Klavyeyi hızlandırır', 'Ağ trafiğini filtreler', 'Dosya sıkıştırır', 'Ekran kaydı alır'], answerIndex: 1 },
  { question: 'İki faktörlü doğrulama (2FA) ne sağlar?', options: ['Daha zayıf şifre', 'Ek güvenlik katmanı', 'Daha yavaş internet', 'Veri kaybı'], answerIndex: 1 },
  { question: 'Phishing saldırısı genelde neyi hedefler?', options: ['Donanım sıcaklığı', 'Kişisel bilgi/şifre', 'Disk birleştirme', 'Ekran çözünürlüğü'], answerIndex: 1 },
  { question: 'Aşağıdakilerden hangisi güçlü şifre yaklaşımıdır?', options: ['123456', 'adsoyad', 'Uzun ve karmaşık benzersiz şifre', 'qwerty'], answerIndex: 2 },
  { question: 'Back-up (yedekleme) neden yapılır?', options: ['Dosyaları silmek için', 'Veri kaybına karşı koruma için', 'İnterneti hızlandırmak için', 'Pil ömrünü uzatmak için'], answerIndex: 1 },
  { question: 'Bulut depolama hizmetine örnek hangisidir?', options: ['Google Drive', 'Paint', 'Notepad', 'BIOS'], answerIndex: 0 },
  { question: 'Tarayıcı çerezleri (cookies) ne için kullanılır?', options: ['CPU hızlandırma', 'Oturum/tercih bilgisi tutma', 'Monitör kalibrasyonu', 'RAM temizleme'], answerIndex: 1 },
  { question: 'API neyin kısaltmasıdır?', options: ['Application Programming Interface', 'Advanced Program Input', 'Applied Process Integration', 'Automatic Protocol Interface'], answerIndex: 0 },
  { question: 'Bir fonksiyonun tekrar kullanılabilir küçük kod bloğu olduğu dil ailesi hangisidir?', options: ['Programlama', 'Tasarım', 'Muhasebe', 'Lojistik'], answerIndex: 0 },
  { question: 'OOP yaklaşımında "class" neyi temsil eder?', options: ['Sunucu markası', 'Nesne şablonu', 'Ağ cihazı', 'Kod hatası'], answerIndex: 1 },
  { question: 'React içinde state güncellemesi genellikle neyi tetikler?', options: ['Disk formatı', 'Yeniden render', 'DNS temizliği', 'Paket kaybı'], answerIndex: 1 },
  { question: 'Node.js hangi motoru kullanır?', options: ['SpiderMonkey', 'V8', 'Trident', 'Blink'], answerIndex: 1 },
  { question: 'TypeScript’in JavaScript’e göre temel katkısı nedir?', options: ['Daha az dosya', 'Statik tip kontrolü', 'Sunucu zorunluluğu', 'Tarayıcı bağımlılığı'], answerIndex: 1 },
  { question: 'WebSocket ne sağlar?', options: ['Tek yönlü e-posta', 'Çift yönlü gerçek zamanlı iletişim', 'Sadece dosya yükleme', 'Sadece log kaydı'], answerIndex: 1 },
  { question: 'Rate limiting neyi önlemeye yardımcı olur?', options: ['Kod yorumlarını', 'Aşırı istek yükünü ve kötüye kullanımı', 'Dosya adlandırmayı', 'Renk uyumsuzluğunu'], answerIndex: 1 },
  { question: 'Redis genellikle ne için kullanılır?', options: ['3D modelleme', 'Önbellek ve hızlı veri erişimi', 'E-posta tasarımı', 'Video düzenleme'], answerIndex: 1 },
  { question: 'Load balancer ne yapar?', options: ['Veriyi şifreler', 'Trafiği sunuculara dağıtır', 'Veritabanını siler', 'Ekran kartını yönetir'], answerIndex: 1 },
  { question: 'Semantik sürümleme (SemVer) örneği hangisidir?', options: ['v1', '1.2.3', '2026', 'build-44'], answerIndex: 1 },
  { question: 'Hata ayıklama (debug) neyi ifade eder?', options: ['Koddan hata bulup düzeltme süreci', 'Sadece kod yazma', 'Sadece test silme', 'Veri şifreleme'], answerIndex: 0 },
  { question: 'Kullanıcı deneyimi (UX) temel olarak neyi hedefler?', options: ['Sunucu sıcaklığını', 'Kullanım kolaylığı ve memnuniyeti', 'Piksel yoğunluğunu', 'Kod satır sayısını'], answerIndex: 1 },
  { question: 'Erişilebilirlikte kontrast neden önemlidir?', options: ['Daha az trafik için', 'Okunabilirliği artırmak için', 'Dosya boyutunu büyütmek için', 'API hızını düşürmek için'], answerIndex: 1 },
  { question: 'Responsive tasarımın amacı nedir?', options: ['Sadece masaüstünde görünmek', 'Farklı ekran boyutlarına uyum', 'Tarayıcıyı kapatmak', 'Arka planı sabitlemek'], answerIndex: 1 },
  { question: 'PWA açılımı nedir?', options: ['Progressive Web App', 'Private Web Access', 'Public Widget API', 'Programmed Web Action'], answerIndex: 0 },
  { question: 'SSL sertifikası olmayan bir sitede tarayıcı genelde ne uyarısı verir?', options: ['Depolama dolu', 'Güvenli değil', 'Ses kapalı', 'Klavye hatası'], answerIndex: 1 },
  { question: 'Bir projede README dosyası ne işe yarar?', options: ['Sadece lisans tutar', 'Kurulum ve kullanım bilgisi verir', 'Kod derler', 'Veritabanı şeması oluşturur'], answerIndex: 1 },
  { question: 'Yazılımda "rollback" neyi ifade eder?', options: ['Yeni özellik ekleme', 'Önceki sürüme geri dönme', 'Şifre sıfırlama', 'Sunucuyu kapatma'], answerIndex: 1 },
];

export const KNOWLEDGE_QUIZ_QUESTION_BANK: QuizQuestion[] = RAW_QUIZ_QUESTIONS.slice(0, 100);

const hashSeed = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildQuizRoundSet = (
  seedSource: string | number,
  roundCount: number
): QuizQuestion[] => {
  const source = String(seedSource || 'cafeduo-quiz-seed');
  const safeRoundCount = Math.max(1, Math.min(KNOWLEDGE_QUIZ_QUESTION_BANK.length, Math.floor(roundCount || 0)));
  const random = mulberry32(hashSeed(source));
  const shuffled = [...KNOWLEDGE_QUIZ_QUESTION_BANK];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, safeRoundCount);
};
