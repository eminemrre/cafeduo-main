/**
 * Café-owner landing (/kafeler), the Vitrin register of DESIGN.md: the same table stationery as
 * the player landing, written for the owner. The pilot card is the first screen, the set-up is
 * an order slip, the benefits are colour sheets, the price list is set like the café's menu,
 * the answers are reading text, and the close is a sentence whose blank is the café's name.
 * Terms are fixed by the business (PRODUCT.md): Pro ₺800/ay, yıllık ₺6.400; the first two pilot
 * cafés get the first month free for a 20-minute feedback session and the use of their name.
 */
import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { LandingExperience } from './LandingExperience';
import { toyImage } from './landing/landingContent';
import { CONTACT_EMAIL, DEFAULT_PILOT_MESSAGE, pilotMailto, whatsappLink } from '../lib/ownerContact';

const whatsappHref = whatsappLink();

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const HERO_FACTS = [
  { what: 'İlk 2 kafe, ilk ay', value: 'ücretsiz' },
  { what: 'Kurulum', value: 'birlikte' },
  { what: 'Sözleşme', value: 'istediğiniz an iptal' },
  { what: 'CafeDuo Pro', value: '₺800/ay' },
] as const;

/** The pilot card: what the owner gets, on one sheet of the table's stationery. The page's
 *  primary action (Pilota başvur) lives in the header, so the card carries none of its own. */
const Hero: React.FC = () => (
  <section
    id="ust"
    className="cdl-field cdl-hero cdl-owner-hero"
    aria-label="Kafe sahipleri için ana bölüm"
  >
    <div className="cdl-tent">
      <div className="cdl-tent-stack">
        <div className="cdl-tent-card cdl-owner-card" data-landing-reveal>
          <i className="cdl-scallop cdl-scallop-tl" aria-hidden="true" />
          <i className="cdl-scallop cdl-scallop-tr" aria-hidden="true" />
          <h1>
            <span className="cdl-tent-line-1">Kahve sizden.</span>{' '}
            <span className="cdl-tent-line-2">Oyun bizden.</span>
          </h1>
          <p className="cdl-tent-offer">
            Masalarınızda oyun başlasın; müşterileriniz puan biriktirsin, seçtiğiniz ödüller için
            yeniden gelsin.
          </p>
          <ul className="cdl-owner-facts" aria-label="Anahtar sayılar">
            {HERO_FACTS.map((fact) => (
              <li className="cdl-slip-row" key={fact.what}>
                <span className="cdl-slip-what">{fact.what}</span>
                <span className="cdl-slip-dots" aria-hidden="true" />
                <span className="cdl-slip-value">{fact.value}</span>
              </li>
            ))}
          </ul>
          <div className="cdl-owner-card-foot">
            <a className="cdl-quiet" href="#nasil-calisir">
              Nasıl işler
            </a>
            <a className="cdl-quiet" href="#fiyat">
              Fiyat
            </a>
          </div>
        </div>
      </div>
    </div>
    <img
      className="cdl-hero-cup cdl-owner-cup"
      src={toyImage('cup')}
      width={720}
      height={720}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  </section>
);

/** The offer itself, as a strip of the pilot's colour. */
const Pilot: React.FC = () => (
  <section className="cdl-field cdl-owner-pilot" aria-label="Pilot programı özet kartı">
    <div className="cdl-owner-pilot-copy">
      <h2 data-landing-reveal>Bir ay birlikte deneyelim</h2>
      <p data-landing-reveal>
        İlk iki kafe için ilk ay ücretsiz. Kurulumu birlikte yapıyoruz; pilot sonunda 20 dakikalık
        bir geri bildirim ve kafenizin adını kullanma izni karşılığında.
      </p>
    </div>
    <a className="cdl-button cdl-owner-pilot-action" href={whatsappHref} {...external}>
      WhatsApp’tan konuşalım <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  </section>
);

const SET_UP = [
  {
    label: 'Kurulumda',
    rows: [
      { what: 'Kafenin konumu ve masaları', value: 'birlikte' },
      { what: 'Ödüller ve puan karşılıkları', value: 'siz seçersiniz' },
      { what: 'Masa QR kodları', value: 'hazırlıyoruz' },
    ],
  },
  {
    label: 'Masada',
    rows: [
      { what: 'Müşteri masadaki QR’ı okutur', value: 'tarayıcıda' },
      { what: 'Yan masayla bir oyun açar', value: '3 oyun' },
      { what: 'Kazandığı puan hesabına geçer', value: 'maç bitince' },
    ],
  },
  {
    label: 'Kasada',
    rows: [
      { what: 'Puanını ödül kuponuna çevirir', value: 'menüden' },
      { what: 'Kuponu kafe panelinden okutursunuz', value: 'tek sefer' },
    ],
  },
] as const;

/** The set-up, printed as the order slip. */
const HowItWorks: React.FC = () => (
  <section
    id="nasil-calisir"
    className="cdl-field cdl-slip"
    aria-label="Nasıl çalışır"
  >
    <div className="cdl-slip-copy">
      <h2 id="cdl-owner-slip-title" data-landing-reveal>
        Bir masadan başlar
      </h2>
      <p data-landing-reveal>
        Uygulama yüklemek yok: müşteri masadaki kodla tarayıcıdan girer, aynı kafedeki biriyle
        oynar, puanını sizin ödüllerinizde harcar.
      </p>
    </div>
    <div className="cdl-slip-sheet" data-landing-reveal>
      {SET_UP.map((group) => (
        <div className="cdl-slip-group" key={group.label}>
          <h3>{group.label}</h3>
          <ul>
            {group.rows.map((row) => (
              <li className="cdl-slip-row" key={row.what}>
                <span className="cdl-slip-what">{row.what}</span>
                <span className="cdl-slip-dots" aria-hidden="true" />
                <span className="cdl-slip-value">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="cdl-slip-result">
        <span>Pilot sonunda değerlendirme</span>
        <span>20 dakika</span>
      </p>
    </div>
  </section>
);

const BENEFITS = [
  {
    tone: 'gok',
    title: 'Geri dönen müşteri',
    text: 'Biriktirilen puanlar yalnızca sizin kafenizin ödüllerinde harcanır; ödül için yeniden gelmenin bir sebebi olur.',
    toy: 'knight',
  },
  {
    tone: 'limon',
    title: 'Masada geçen zaman',
    text: 'Kahvenin yanına satranç, bilgi yarışı ve düello. Etkisini pilotta birlikte değerlendiririz.',
    toy: 'quiz',
  },
  {
    tone: 'lokum',
    title: 'Arkadaş getiren müşteri',
    text: 'Rakip yan masada: düellolar ve liderlik tablosu, arkadaşların birlikte geldiği bir buluşma noktası olur.',
    toy: 'target',
  },
  {
    tone: 'fistik',
    title: 'Kafenize ait ödüller',
    text: 'Ödülleri ve puanlarını siz belirlersiniz; kahve, tatlı ya da indirim. Kupon kasada QR ile okutulur.',
    toy: 'coin',
  },
] as const;

/** The benefits: four colour sheets stacking like the games on the player landing. */
const Benefits: React.FC = () => (
  <section className="cdl-field cdl-sheets cdl-owner-sheets" aria-label="Faydalar">
    <h2 id="cdl-owner-sheets-title" data-landing-reveal>
      Kafenize ne katar
    </h2>
    <ol className="cdl-sheet-stack">
      {BENEFITS.map((benefit, index) => (
        <li
          key={benefit.title}
          className={`cdl-sheet cdl-sheet-${benefit.tone}`}
          style={{ '--sheet-index': index } as React.CSSProperties}
        >
          <div className="cdl-sheet-copy">
            <h3 data-landing-reveal>{benefit.title}</h3>
            <p data-landing-reveal>{benefit.text}</p>
          </div>
          <img
            className="cdl-sheet-toy"
            src={toyImage(benefit.toy)}
            width={720}
            height={720}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            data-landing-reveal
          />
        </li>
      ))}
    </ol>
  </section>
);

const PRICES = [
  {
    label: 'CafeDuo Pro',
    items: [
      { name: 'Aylık', price: '₺800', note: 'Sınırsız müşteri ve oyun, kafe paneli' },
      { name: 'Yıllık', price: '₺6.400', note: 'Dört ay hediye; ayda ₺533’e denk gelir' },
    ],
  },
  {
    label: 'Pilot',
    items: [
      {
        name: 'İlk 2 kafe, ilk ay',
        price: '₺0',
        note: '20 dakikalık geri bildirim ve kafe adınızı kullanma izni karşılığında',
      },
    ],
  },
  {
    label: 'Pakette',
    items: [
      { name: 'Kafe paneli ve analitik', price: 'dahil' },
      { name: 'Kupon ve çark yönetimi', price: 'dahil' },
      { name: 'Turnuvalar', price: 'dahil' },
      { name: 'Gizlilik ve veri yönetimi', price: 'dahil' },
      { name: 'WhatsApp destek hattı', price: 'dahil' },
    ],
  },
] as const;

/** The price list, set the way the café's own menu sets prices. */
const Prices: React.FC = () => (
  <section id="fiyat" className="cdl-field cdl-owner-prices" aria-label="Fiyatlandırma">
    <h2 data-landing-reveal>Fiyat</h2>
    <div className="cdl-owner-price-list">
      {PRICES.map((group) => (
        <div className="cdl-owner-price-group" key={group.label} data-landing-reveal>
          <h3>{group.label}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item.name}>
                <p className="cdl-owner-price-row">
                  <span>{item.name}</span>
                  <span className="cdl-owner-price">{item.price}</span>
                </p>
                {'note' in item && <p className="cdl-owner-price-note">{item.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="cdl-owner-price-chain" data-landing-reveal>
        Üç ve daha fazla şubeli zincirler için teklif:{' '}
        <a href={whatsappHref} {...external}>
          WhatsApp’tan yazın
        </a>
        .
      </p>
    </div>
  </section>
);

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Uygulama yüklemek gerekiyor mu?',
    a: 'Hayır. Müşterileriniz masa QR koduyla CafeDuo’yu telefonlarının tarayıcısında açar; dileyen ana ekranına ekler.',
  },
  {
    q: 'Kafede olmayan biri oynayabilir mi?',
    a: 'Hayır. Check-in yalnızca kafenin içinde çalışır: belirlediğiniz konum yarıçapında (varsayılan 150 m) ya da masanın doğrulama koduyla.',
  },
  {
    q: 'Hangi oyunlar var?',
    a: 'Retro Satranç (3+2 ya da 5+0 tempo), Bilgi Yarışı (on kısa soru) ve Nişancı Düellosu (beş tur). Her biri bir kahvelik sürer.',
  },
  {
    q: 'Pilot bittikten sonra ne olur?',
    a: 'İlk ayın sonunda deneyimi birlikte değerlendiririz. Devam etmek isterseniz Pro planı konuşuruz; pilot başvurusu otomatik bir ödeme başlatmaz.',
  },
  {
    q: 'Müşteri verileri nasıl korunur?',
    a: (
      <>
        Parolalar açık metin olarak saklanmaz; yönetim işlemleri yetkili hesaplarla yapılır. Hangi
        verilerin işlendiğini ve taleplerinizi nasıl iletebileceğinizi{' '}
        <a href="/gizlilik">Gizlilik Politikası</a> sayfasında bulabilirsiniz.
      </>
    ),
  },
  {
    q: 'Kuponu kasada nasıl doğrularım?',
    a: 'Müşterinin kuponunu kafe panelinizden okutursunuz. Sistem kuponun geçerliliğini denetler; onaylanan kupon bir daha kullanılamaz.',
  },
  {
    q: 'Başlamak için ne hazırlamalıyım?',
    a: 'Kafenizin konumu, masa sayısı ve sunmak istediğiniz ödüller yeterli. Paneli ve masa QR kodlarını birlikte hazırlarız.',
  },
];

/** The answers, set as reading text: everything answered at a glance, nothing to open. */
const Questions: React.FC = () => (
  <section id="sorular" className="cdl-field cdl-owner-faq" aria-label="Sıkça sorulan sorular">
    <h2 data-landing-reveal>Sorular</h2>
    <div className="cdl-owner-faq-text">
      {FAQS.map((item) => (
        <p key={item.q} data-landing-reveal>
          <strong>{item.q}</strong> {item.a}
        </p>
      ))}
    </div>
  </section>
);

/** The close: the blank is the café's name, and it goes straight into the WhatsApp message.
 *  The link is a real link, so it opens in a new tab and can be copied or opened
 *  with the middle button like any other. */
const Close: React.FC = () => {
  const [name, setName] = useState('');
  const message = name.trim()
    ? `Selam, ${name.trim()} için CafeDuo pilot programına başvurmak istiyorum.`
    : DEFAULT_PILOT_MESSAGE;
  return (
    <section className="cdl-field cdl-cta" aria-label="Son çağrı">
      <div className="cdl-cta-form">
        <p className="cdl-cta-sentence">
          <label htmlFor="cdl-owner-cafe">Pilot için</label>
          <input
            id="cdl-owner-cafe"
            className="cdl-cta-input"
            type="text"
            name="cafe"
            autoComplete="organization"
            placeholder="kafenizin adı"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <span className="cdl-cta-tail">
            <span>ile</span>
            <a
              className="cdl-cta-submit"
              href={whatsappLink(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              başvurun
            </a>
          </span>
        </p>
        <p className="cdl-cta-note" data-landing-reveal>
          Mesaj WhatsApp’ta hazır açılır, göndermeden önce düzenleyebilirsiniz. E-postayı tercih
          ederseniz: <a href={pilotMailto}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </section>
  );
};

export const BusinessLanding: React.FC = () => (
  <LandingExperience>
    <div className="cdl">
      <Hero />
      <Pilot />
      <HowItWorks />
      <Benefits />
      <Prices />
      <Questions />
      <Close />
    </div>
  </LandingExperience>
);

export default BusinessLanding;
