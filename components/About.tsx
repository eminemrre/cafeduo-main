import React from 'react';
import { Coffee, Gift, ShieldCheck, Timer, Users } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from './ui';

const pillars = [
  {
    icon: Users,
    title: 'Anlık Eşleşme',
    text: 'Aynı kafedeki oyuncularla karşılaş. Her masa yeni bir rakip olabilir.',
  },
  {
    icon: Timer,
    title: 'Kısa Tur Dinamiği',
    text: 'Küçük bir mola için tasarlanan turlar. Bir oyun daha demek kolay.',
  },
  {
    icon: ShieldCheck,
    title: 'Güvenli Giriş',
    text: 'Kafeni ve masanı doğrula, sana ait oyuncu profiliyle devam et.',
  },
  {
    icon: Gift,
    title: 'Ödül Döngüsü',
    text: 'Kazandığın puanları biriktir. Kafenin sunduğu ödüllerden kendine bir şey seç.',
  },
];

export const About: React.FC = () => (
  <section
    id="about"
    className="duo-landing-section riso-kantin bg-paper-deep"
    aria-label="Hakkımızda"
  >
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8 grid gap-10 lg:grid-cols-[1fr_1.2fr] items-start">
      <Reveal className="duo-section-heading">
        <span className="duo-eyebrow mb-4">BİR MASADAN DAHA FAZLASI.</span>
        <h2 data-testid="about-main-heading">
          Biraz rekabet. <br />
          <span className="text-riso-pink-deep">Bolca iyi vakit.</span>
        </h2>
        <p>
          Kahve içmek zaten güzel. Bir rakiple tanışmak, iyi bir hamle yapmak ve sonraki kahven için
          puan toplamak daha da güzel.
        </p>
        <div className="mt-8 rounded-2xl bg-riso-blue text-paper p-6">
          <Coffee size={30} className="mb-4" />
          <h3 className="font-riso-display text-xl leading-snug tracking-tight">
            Aynı kafe. <br />
            Yeni bir buluşma sebebi.
          </h3>
          <p className="text-sm leading-6 mt-3 !text-paper/80">
            CafeDuo, kahve molasına oyun ve karşılaşma heyecanı ekler.
          </p>
        </div>
      </Reveal>
      <RevealGroup className="grid gap-x-7 gap-y-8 sm:grid-cols-2">
        {pillars.map(({ icon: Icon, title, text }) => (
          <RevealItem as="article" key={title} className="border-t border-carbon/20 pt-5">
            <Icon size={24} className="text-riso-pink-deep" />
            <h3 className="text-lg font-semibold mt-4">{title}</h3>
            <p className="text-carbon-muted text-sm leading-6 mt-2">{text}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  </section>
);
