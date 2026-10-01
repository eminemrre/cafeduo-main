import React from 'react';
import { ArrowRight, Coffee, Trophy, UserPlus } from 'lucide-react';
import { RevealGroup, RevealItem } from './ui';

const steps = [
  {
    id: '01',
    title: 'Hesabını aç',
    description: 'Oyuncu adını seç. Kendine ait bir profil ile CafeDuo’ya katıl.',
    icon: UserPlus,
    tone: 'bg-riso-pink',
    hint: 'Kendi oyuncu kimliğin',
  },
  {
    id: '02',
    title: 'Kafeye bağlan',
    description: 'Bulunduğun kafeyi ve masanı doğrula. Oyun alanına giriş yap.',
    icon: Coffee,
    tone: 'bg-riso-blue text-paper',
    hint: 'Kafen, masan, oyun alanın',
  },
  {
    id: '03',
    title: 'Eşleş ve kazan',
    description: 'Bir oyun kur ya da rakibine katıl. Puanlarını biriktir, ödülünü seç.',
    icon: Trophy,
    tone: 'bg-riso-mustard',
    hint: 'Bir sonraki kahvene yaklaş',
  },
];

export const HowItWorks: React.FC = () => (
  <section
    id="features"
    className="duo-landing-section riso-kantin bg-paper-deep"
    aria-label="Nasıl çalışır"
  >
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      <div className="duo-section-heading">
        <span className="duo-eyebrow mb-4">NASIL ÇALIŞIR?</span>
        <h2 data-testid="flow-main-heading">
          3 adımda eşleş, oyna, <br />
          <span className="text-riso-pink-deep">ödüle yaklaş.</span>
        </h2>
        <p>Kafedeki molana küçük bir rekabet, büyük bir keyif ekle.</p>
      </div>
      <RevealGroup className="grid gap-4 md:grid-cols-3">
        {steps.map(({ id, title, description, icon: Icon, tone, hint }) => (
          <RevealItem
            as="article"
            key={id}
            data-testid={`how-step-${id}`}
            className="duo-step-card"
          >
            <div className="duo-step-top">
              <span className={`duo-step-icon ${tone}`}>
                <Icon size={22} />
              </span>
              <span className="duo-step-number">{id}</span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <div className="duo-step-foot">
              <span>{hint}</span>
              <ArrowRight size={14} />
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  </section>
);
