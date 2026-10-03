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
  { icon: <Clock size={18} />, label: 'Kurulum', value: '30 dakika' },
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
    body: "Konum, masa sayısı ve 3 ödül seçeneği girin. Setup'ı bizzat birlikte yapıyoruz.",
  },
  {
    n: '02',
    title: 'Müşteriler oynar',
    body: 'Masadan QR ile giriş yaparlar, 5 dakikalık oyunlar oynarlar, puan biriktirirler.',
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
          Üç adımda kafe içinde dönen ufak bir ekonomi.
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
    body: 'Puan biriktiren öğrenci ödülünü kullanmaya geri gelir. Sadakat kartı doğal hâliyle çalışır.',
  },
  {
    icon: <TrendingUp size={20} />,
    title: 'Daha uzun oturum, daha çok sipariş',
    body: 'Oyun = 15–30 dk ek masa süresi. Doluluk saatleri dışında en hissedilir fark burada.',
  },
  {
    icon: <Users size={20} />,
    title: 'Arkadaş getiren müşteri',
    body: 'Liderlik tablosu ve düello mekaniği = öğrenciler arkadaşlarını kafenize çağırır.',
  },
  {
    icon: <Sparkles size={20} />,
    title: 'Ücretsiz Instagram görünürlüğü',
    body: "Kazanılan ödüller story'lere giriyor — lokasyon etiketi ve marka adı doğal yoldan paylaşılır.",
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
          Tek bir plan, gizli madde yok. Pilotu memnun bitirirseniz aynı plana geçersiniz.
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
// FAQ — substantive answers (no one-liners)
// ─────────────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Müşterilerimin telefonlarına uygulama yüklemesi gerekiyor mu?',
    a: "Hayır. CafeDuo modern bir Progressive Web App (PWA) olarak çalışır — kafenizdeki masa QR kodunu tarayan müşteri saniyeler içinde tarayıcıdan sisteme giriş yapar; App Store veya Play Store sürtüşmesi yoktur. Sık gelen müşteri isterse tek dokunuşla CafeDuo'yu ana ekranına ekleyebilir, ancak bu zorunlu değildir. Oturum başına yaklaşık 3–5 MB veri kullanır, üç beş yıllık telefonlarda dahi akıcı çalışır.",
  },
  {
    q: 'Pilot programının sonunda ne oluyor, otomatik ödeme alınıyor mu?',
    a: 'Hayır, otomatik ödeme yok. Pilot bitmeden 5 gün önce WhatsApp üzerinden sizinle iletişime geçer, birlikte ölçümlere bakarız: gerçekleşen oturum sayısı, kullanılan kuponlar, müşteri akışının değiştiği saatler. Devam etmek istiyorsanız Pro plana açık rızanızla geçeriz; istemiyorsanız hesap sessizce kapanır ve pilot süresince oluşmuş kafe verileri KVKK gereği size raporlanır, ardından silinir. Hiçbir gizli ücret veya iptal cezası işletilmez.',
  },
  {
    q: 'KVKK ve veri güvenliği konusunda nasıl bir altyapı kullanılıyor?',
    a: "CafeDuo, KVKK ve GDPR çerçevesine uygun olarak tasarlandı. Müşteriden işin yürümesi için zorunlu olan minimum veri (kullanıcı adı, e-posta, opsiyonel avatar) alınır; konum verisi yalnızca masa check-in anında doğrulama amacıyla kullanılır ve sunucuda saklanmaz. Aydınlatma metni, açık rıza akışları ve veri silme talebi süreçleri sistemin içine gömülüdür. Parolalar bcrypt cost=12 ile hash'lenir, SQL enjeksiyon koruması için tüm sorgular parametrelidir. Detaylı politika /gizlilik sayfasında, denetim için resmi belge setine WhatsApp'tan ulaşabilirsiniz.",
  },
  {
    q: 'Kuponların sahteleştirilmesi veya iki kez kullanılması mümkün mü?',
    a: 'Hayır. Her kupon, müşteri uygulamasında benzersiz bir QR kod olarak görünür; siz kasada CafeDuo panelinin doğrulama ekranıyla bunu tararsınız ve sistem atomik bir veritabanı işlemiyle kuponu o anda iptal eder. Aynı kupon tekrar gösterilse bile geçersiz çıkar, ekran görüntüsü ile sahteleme yapılamaz. İsterseniz personeliniz için ayrı bir "kasiyer" rolü oluşturup yetkilerini kısıtlayabilir, günlük kupon kullanım raporlarını panelden inceleyebilirsiniz.',
  },
  {
    q: 'Kurulum süreci nasıl ilerliyor, benden ne kadar vakit isteniyor?',
    a: "Ortalama 30 dakikada birlikte tamamlıyoruz. WhatsApp video görüşmesinde önce kafenizin GPS koordinatını sabitleyip masalarınız için günlük dönen güvenlik PIN'lerini tanımlıyoruz. Ardından müşterilerinize sunacağınız 3 başlangıç ödülünü panelden giriyoruz — örneğin: 250 puan = filtre kahve, 500 puan = %10 indirim kuponu, 1000 puan = ev tatlısı. Görüşme sonunda masalara koyacağınız QR kodlarını PDF olarak elinize ulaştırıyoruz; ertesi gün masalara yerleştirmek dışında sizden bir aksiyon beklenmiyor.",
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
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-carbon text-carbon transition-transform group-open:rotate-45">
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
