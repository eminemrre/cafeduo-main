/** Cafe-owner landing: shared ceramic identity and native, readable sections. */
import React from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  MessageCircle,
  Repeat,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { CafeScene3D } from './CafeScene3D';
import { LandingExperience, LandingMotionControl, useLandingMotion } from './LandingExperience';

const WHATSAPP_NUMBER = '905538542535';
const WHATSAPP_PREFILL = encodeURIComponent(
  'Selam, cafeduotr.com pilot programı için yazıyorum. Kafem hakkında konuşabilir miyiz?'
);
const CONTACT_EMAIL = 'info@cafeduotr.com';

const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_PREFILL}`;
const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=Pilot%20Ba%C5%9Fvuru&body=Kafemin%20ad%C4%B1%3A%20%0AKonum%3A%20%0AInstagram%3A%20%0A`;

export const BusinessLanding: React.FC = () => (
  <LandingExperience>
    <div className="owner-landing riso-kantin riso-kantin-app">
      <HeroSection />
      <NumbersBar />
      <HowItWorksOwner />
      <ValueProps />
      <PricingSection />
      <FaqSection />
      <ClosingCta />
    </div>
  </LandingExperience>
);

const HeroSection: React.FC = () => {
  const motion = useLandingMotion();
  return (
    <section aria-label="Kafe sahipleri için ana bölüm" className="owner-hero">
      <div className="owner-container owner-hero-layout">
        <div className="owner-intro">
          <div className="club-hero-meta">
            <p className="club-kicker">Kafeniz için CafeDuo</p>
            <LandingMotionControl />
          </div>
          <h1>
            Kahve sizden.
            <br />
            <em>Oyun bizden.</em>
          </h1>
          <p className="owner-intro-copy">
            Masalarınızda oyun başlasın. Müşterileriniz puan biriktirsin, sizin seçtiğiniz ödüllerle
            kafenize yeniden gelsin.
          </p>
          <div className="owner-hero-actions">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="owner-primary riso-focus"
            >
              Pilota başvur <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <button
              type="button"
              className="owner-secondary riso-focus"
              onClick={() => {
                document
                  .getElementById('nasil-calisir')
                  ?.scrollIntoView({ behavior: motion?.enabled ? 'smooth' : 'instant' });
              }}
            >
              Nasıl çalışır <ChevronDown size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        <CafeScene3D />
      </div>
      <aside
        aria-label="Pilot programı özet kartı"
        className="owner-container owner-pilot"
        data-landing-reveal
      >
        <div>
          <p className="club-kicker">İlk 2 kafe için</p>
          <h2>Bir ay birlikte deneyelim.</h2>
          <p>
            İlk ay ücretsiz. Kurulumu birlikte yapıyoruz. Pilot sonunda 20 dakika geri bildirim ve
            kafe adınızı kullanma izni karşılığında.
          </p>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="owner-primary riso-focus"
        >
          WhatsApp’tan konuşalım <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </aside>
    </section>
  );
};

const NUMBERS = [
  { icon: <Clock size={18} />, label: 'Kurulum', value: 'Birlikte hazırlıyoruz' },
  { icon: <Repeat size={18} />, label: 'Sözleşme', value: 'İstediğin an iptal' },
  { icon: <Sparkles size={18} />, label: 'Pilot', value: '1 ay ücretsiz' },
];

const NumbersBar: React.FC = () => (
  <section aria-label="Anahtar sayılar" className="border-t border-carbon/15 bg-paper">
    <div
      data-landing-reveal
      className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-carbon/15 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6"
    >
      {NUMBERS.map((n) => (
        <div
          data-landing-reveal
          key={n.label}
          className="flex items-center gap-4 px-2 py-6 sm:px-6"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-carbon text-carbon">
            {n.icon}
          </span>
          <div>
            <p className="font-riso-mono text-[0.65rem] uppercase tracking-[0.16em] text-carbon-soft">
              {n.label}
            </p>
            <p className="font-riso-display text-xl text-carbon">{n.value}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// How It Works — owner POV (inline numbers, no floating badges)
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    title: 'Kafenizi tanıtın',
    body: 'Kafenizin konumunu, masalarını ve sunmak istediğiniz ödülleri birlikte hazırlıyoruz.',
  },
  {
    n: '02',
    title: 'Müşteriler oynar',
    body: 'Masa QR koduyla CafeDuo’yu açar, oyunlara katılır ve puan biriktirirler.',
  },
  {
    n: '03',
    title: 'Sizin ödülünüzü alırlar',
    body: 'Puanlarını kahve, indirim veya tatlı kuponuna çevirirler. Kupon QR ile kasada gösterilir.',
  },
];

const HowItWorksOwner: React.FC = () => (
  <section
    id="nasil-calisir"
    aria-label="Nasıl çalışır"
    className="border-t border-carbon/15 bg-paper py-20 sm:py-28"
  >
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="mb-14 max-w-2xl">
        <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">Akış</p>
        <h2 className="mt-3 font-riso-display text-[2rem] leading-tight tracking-tight text-carbon sm:text-[2.6rem]">
          Bir masadan başlayan oyun.
        </h2>
      </header>

      <div data-landing-reveal className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-3">
        {STEPS.map((s) => (
          <div data-landing-reveal key={s.n} className="relative">
            <div className="flex items-baseline gap-3">
              <span className="font-riso-display text-2xl text-carbon-soft">{s.n}</span>
              <span className="h-px flex-1 bg-carbon/20" />
            </div>
            <h3 className="mt-4 font-riso-display text-xl leading-tight text-carbon">{s.title}</h3>
            <p className="mt-3 font-riso-body text-[15px] leading-relaxed text-carbon-soft">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Value props — owner-side benefits, flat outlines
// ─────────────────────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon: <Repeat size={20} />,
    title: 'Geri dönen müşteri',
    body: 'Müşterilerinize, biriktirdikleri puanları kafenizin ödüllerinde kullanma fırsatı sunun.',
  },
  {
    icon: <TrendingUp size={20} />,
    title: 'Masada birlikte geçirilen zaman',
    body: 'Kahvenin yanına satranç, bilgi yarışması ve düello ekleyin. Etkisini pilotta birlikte değerlendirelim.',
  },
  {
    icon: <Users size={20} />,
    title: 'Arkadaş getiren müşteri',
    body: 'Liderlik tablosu ve düellolarla arkadaşların birlikte oynayabileceği bir buluşma noktası oluşturun.',
  },
  {
    icon: <Sparkles size={20} />,
    title: 'Kafenize ait ödüller',
    body: 'Ödül seçeneklerini ve puanlarını siz belirleyin; müşterileriniz oyun deneyimini kafenizle ilişkilendirsin.',
  },
];

const ValueProps: React.FC = () => (
  <section aria-label="Faydalar" className="border-t border-carbon/15 bg-paper py-20 sm:py-28">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="mb-14 max-w-2xl">
        <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">
          Sahibe katkı
        </p>
        <h2 className="mt-3 font-riso-display text-[2rem] leading-tight tracking-tight text-carbon sm:text-[2.6rem]">
          Kafenizin günlüğüne neler ekler?
        </h2>
      </header>

      <div data-landing-reveal className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
        {BENEFITS.map((b) => (
          <div data-landing-reveal key={b.title} className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-carbon text-carbon">
              {b.icon}
            </span>
            <div>
              <h3 className="font-riso-display text-lg leading-tight text-carbon">{b.title}</h3>
              <p className="mt-2 font-riso-body text-[15px] leading-relaxed text-carbon-soft">
                {b.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Pricing — single Pro card, pilot inline
// ─────────────────────────────────────────────────────────────────────────────
const PricingSection: React.FC = () => (
  <section aria-label="Fiyatlandırma" className="border-t border-carbon/15 bg-paper py-20 sm:py-28">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <header className="mb-12 text-left">
        <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">
          Şeffaf fiyat
        </p>
        <h2 className="mt-3 font-riso-display text-[2rem] leading-tight tracking-tight text-carbon sm:text-[2.6rem]">
          Önce deneyin, sonra konuşuruz.
        </h2>
        <p className="mt-3 font-riso-body text-[15px] leading-relaxed text-carbon-soft">
          Pilot sonunda birlikte değerlendirelim. Devam etmek isterseniz planınızı konuşalım.
        </p>
      </header>

      <div
        data-landing-reveal
        className="border-2 border-carbon bg-paper p-7 riso-shadow-md sm:p-9"
      >
        <div className="flex flex-col gap-2 border-b border-carbon/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-riso-mono text-[0.7rem] uppercase tracking-[0.18em] text-carbon-soft">
              CafeDuo Pro
            </p>
            <p className="mt-2 font-riso-display text-5xl leading-none text-carbon">
              ₺800<span className="font-riso-body text-lg text-carbon-soft"> /ay</span>
            </p>
          </div>
          <p className="font-riso-mono text-xs uppercase tracking-[0.14em] text-carbon-soft">
            Yıllık ₺6.400 · 4 ay hediye
          </p>
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 font-riso-body text-[15px] text-carbon sm:grid-cols-2">
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> Sınırsız müşteri & oyun
          </li>
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> Kafe paneli + analitik
          </li>
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> Kupon ve çark yönetimi
          </li>
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> Gizlilik ve veri yönetimi
          </li>
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> WhatsApp destek hattı
          </li>
          <li className="flex items-start gap-2">
            <Check size={16} className="mt-1 shrink-0" /> İstediğin an iptal
          </li>
        </ul>

        <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-carbon/20 pt-6 sm:flex-row sm:items-center">
          <p className="font-riso-body text-sm text-carbon">
            <span className="font-bold text-riso-pink-deep">İlk 2 pilot kafe</span> için ilk ay{' '}
            <span className="font-bold">₺0</span> — vaka çalışması karşılığında.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="riso-focus inline-flex items-center gap-2 bg-carbon px-5 py-3 font-riso-body text-sm font-bold uppercase tracking-[0.1em] text-paper transition-transform hover:translate-y-[-1px]"
          >
            Pilot için yaz <ArrowUpRight size={16} className="opacity-70" />
          </a>
        </div>
      </div>

      <p className="mt-6 font-riso-body text-sm text-carbon-soft">
        3+ şubeli zincir kafelere özel teklif için{' '}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-carbon decoration-2 underline-offset-2 hover:text-riso-pink-deep"
        >
          WhatsApp&apos;tan yazın
        </a>
        .
      </p>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// FAQ — concise answers grounded in the current product.
// ─────────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Uygulama yüklemek gerekiyor mu?',
    a: 'Hayır. Müşterileriniz masa QR koduyla CafeDuo’yu telefonlarının tarayıcısında açabilir. Dileyenler ana ekranına da ekleyebilir.',
  },
  {
    q: 'Pilot bittikten sonra ne olur?',
    a: 'İlk ayın sonunda deneyimi birlikte değerlendiririz. Devam etmek isterseniz Pro planın koşullarını konuşuruz; pilot başvurusu otomatik bir ödeme başlatmaz.',
  },
  {
    q: 'Müşteri verileri nasıl korunur?',
    a: (
      <>
        Parolalar açık metin olarak saklanmaz; yönetim işlemleri yetkili hesaplarla yapılır. Hangi
        verilerin işlendiğini ve taleplerinizi nasıl iletebileceğinizi{' '}
        <a href="/gizlilik" className="riso-focus underline decoration-current underline-offset-4">
          Gizlilik Politikası
        </a>{' '}
        sayfasında bulabilirsiniz.
      </>
    ),
  },
  {
    q: 'Kuponu kasada nasıl doğrularım?',
    a: 'Müşterinin kupon kodunu kafe panelinizden kontrol edersiniz. Sistem kuponun geçerliliğini ve kullanılıp kullanılmadığını denetler; kullanım onaylandığında kupon tekrar kullanılamaz.',
  },
  {
    q: 'Başlamak için ne hazırlamalıyım?',
    a: 'Kafenizin konumu, masa sayısı ve sunmak istediğiniz ödüller yeterli. WhatsApp üzerinden iletişime geçin; paneli ve masa QR kodlarını birlikte hazırlayalım.',
  },
];

const FaqSection: React.FC = () => (
  <section
    aria-label="Sıkça sorulan sorular"
    className="border-t border-carbon/15 bg-paper py-20 sm:py-28"
  >
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <header data-landing-reveal className="mb-10 text-left">
        <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">
          Sık sorulanlar
        </p>
        <h2 className="mt-3 font-riso-display text-[2rem] leading-tight tracking-tight text-carbon sm:text-[2.6rem]">
          Aklınıza gelen ilkler.
        </h2>
      </header>

      <div className="divide-y divide-carbon/20 border-y border-carbon/20">
        {FAQS.map((f, i) => (
          <details key={i} className="group py-5">
            <summary className="riso-focus flex cursor-pointer list-none items-start justify-between gap-4 font-riso-body text-base font-semibold text-carbon">
              <span className="flex-1">{f.q}</span>
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-carbon text-carbon transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-2xl font-riso-body text-[15px] leading-relaxed text-carbon-soft">
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Closing — carbon (dark) for premium close
// ─────────────────────────────────────────────────────────────────────────────
const ClosingCta: React.FC = () => (
  <section aria-label="Son çağrı" className="relative bg-carbon py-20 text-paper sm:py-28">
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <div data-landing-reveal className="grid gap-8 md:grid-cols-12 md:items-end">
        <div data-landing-reveal className="md:col-span-7">
          <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-paper/70">
            Sıra sizde
          </p>
          <h2 className="mt-3 font-riso-display text-[2.2rem] leading-tight tracking-tight sm:text-[3rem]">
            İlk 2 kafeden biri olun.
          </h2>
          <p className="mt-4 max-w-xl font-riso-body text-[15px] leading-relaxed text-paper/85">
            1 ay tamamen ücretsiz. 20 dakika geri bildirim + isim kullanım izni karşılığında.
            Kurulumu birlikte yapıyoruz.
          </p>
        </div>

        <div data-landing-reveal className="flex flex-col gap-3 md:col-span-5">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="riso-focus inline-flex items-center justify-between border-2 border-paper bg-paper px-5 py-3 font-riso-body text-sm font-bold uppercase tracking-[0.1em] text-carbon transition-transform hover:translate-y-[-1px]"
          >
            <span className="inline-flex items-center gap-2">
              <MessageCircle size={16} /> WhatsApp ile başvur
            </span>
            <ArrowUpRight size={16} />
          </a>
          <a
            href={mailtoHref}
            className="riso-focus inline-flex items-center justify-between border-2 border-paper/40 px-5 py-3 font-riso-body text-sm font-bold uppercase tracking-[0.1em] text-paper transition-colors hover:border-paper"
          >
            <span>E-posta gönder</span>
            <ArrowUpRight size={16} className="opacity-70" />
          </a>
          <p className="font-riso-mono text-[0.7rem] uppercase tracking-[0.14em] text-paper/60">
            Cevap genelde 1 saatte gelir.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default BusinessLanding;
