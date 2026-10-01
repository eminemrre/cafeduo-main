import React from 'react';

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
  <section id="features" className="club-flow" aria-label="Nasıl çalışır">
    <div className="club-container club-flow-layout">
      <div>
        <span className="club-kicker">Kulübe giriş</span>
        <h2 data-testid="flow-main-heading">
          Masaya nasıl <br />
          <em>oturulur?</em>
        </h2>
      </div>
      <ol className="club-steps">
        {steps.map(({ id, title, description }) => (
          <li key={id} data-testid={`how-step-${id}`}>
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
