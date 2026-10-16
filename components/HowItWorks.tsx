import React from 'react';
import { SplitWords } from './ui/SplitWords';

const steps = [
  {
    id: '01',
    title: 'Hesabını aç',
    description: 'Bir oyuncu adı seç. Giriş yaptıktan sonra kafeni seçebilirsin.',
  },
  {
    id: '02',
    title: 'Kafeye bağlan',
    description: 'Kafeni ve masa numaranı doğrula. Konum ya da masanın doğrulama koduyla devam et.',
  },
  {
    id: '03',
    title: 'Eşleş ve kazan',
    description: 'Açık bir oyuna katıl veya oyun kur. Puanların, kafenin ödülleri için birikir.',
  },
];

export const HowItWorks: React.FC = () => (
  <section id="features" className="club-flow" aria-label="Nasıl çalışır" data-landing-track>
    <div className="club-container club-flow-layout" data-landing-reveal>
      <div>
        <span className="club-kicker">Kulübe giriş</span>
        <h2 data-testid="flow-main-heading">
          <SplitWords text="Masaya nasıl" /> <br />
          <em>
            <SplitWords text="oturulur?" start={2} />
          </em>
        </h2>
        <div className="club-journey-art" aria-hidden="true">
          <span className="club-journey-table" data-depth="8" data-scroll-depth="50">
            Masa 07 <i>↗</i>
          </span>
          <span className="club-journey-token" data-depth="-14" data-scroll-depth="-40">
            ♞
          </span>
          <span className="club-journey-reward" data-depth="10" data-scroll-depth="30">
            Oyna.
            <br />
            <em>Puan biriktir.</em>
            <br />
            Ödülünü seç.
          </span>
        </div>
      </div>
      <ol className="club-steps" data-landing-track>
        {steps.map(({ id, title, description }) => (
          <li key={id} data-testid={`how-step-${id}`} data-landing-track>
            <span className="club-step-number" aria-hidden="true">
              {id}
            </span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
