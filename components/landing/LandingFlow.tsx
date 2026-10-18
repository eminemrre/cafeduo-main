/**
 * "Masadan ödüle": on wide screens one pinned fragment of the player panel changes state while
 * three short statements scroll past; on phones each statement carries its own state. The numbers follow the real rules: every member starts with 100
 * points, a 20-point stake against MASA07 pays 20, and Oyun Jetonu x5 costs 100.
 */
import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const STEPS = [
  {
    title: 'Önce kafede check-in yap.',
    text: 'Kafenin 150 metre içindeysen ya da masandaki kodu girersen masan açılır.',
  },
  {
    title: 'Sonra açık bir masayla eşleş.',
    text: 'Lobide aynı kafedeki oyunları görürsün. Rakibin ne kadar puan koyduysa en fazla o kadar kazanırsın.',
  },
  {
    title: 'Kazandığını kafede harca.',
    text: 'Puanın o kafenin ödüllerine döner. Kasada QR kuponunu okuturlar.',
  },
];

const CheckInState = () => (
  <div className="cdl-panel-body">
    <p className="cdl-ui-title">Check-in</p>
    <div className="cdl-ui-field">
      <span>Kafe</span>
      <strong>Örnek kafe, Alsancak</strong>
    </div>
    <div className="cdl-ui-field">
      <span>Konum</span>
      <strong>Kafeye 42 m</strong>
      <span className="cdl-ui-meter" aria-hidden="true">
        <span style={{ width: `${(42 / 150) * 100}%` }} />
      </span>
      <small>Sınır 150 m. Konumun doğrulandı.</small>
    </div>
    <div className="cdl-ui-field">
      <span>Masa kodu</span>
      <span className="cdl-ui-input">MASA05</span>
    </div>
    <span className="cdl-ui-button is-hover">Masaya otur</span>
  </div>
);

const LobbyState = () => (
  <div className="cdl-panel-body">
    <p className="cdl-ui-title">
      Açık oyunlar <span>Bakiyen 100 puan</span>
    </p>
    <ul className="cdl-ui-lobby">
      <li className="is-selected">
        <span>
          <strong>MASA07</strong> Retro Satranç, 3+2
        </span>
        <span>20 puan</span>
        <span className="cdl-ui-button">Katıl</span>
      </li>
      <li>
        <span>
          <strong>MASA03</strong> Nişancı Düellosu, 5 tur
        </span>
        <span>10 puan</span>
        <span className="cdl-ui-button is-quiet">Katıl</span>
      </li>
      <li>
        <span>
          <strong>MASA12</strong> Retro Satranç, 5+0
        </span>
        <span>30 puan</span>
        <span className="cdl-ui-button is-quiet">Katıl</span>
      </li>
    </ul>
    <p className="cdl-ui-hint">MASA07 ile eşleştin. Kazanırsan +20 puan.</p>
  </div>
);

const RewardState = () => (
  <div className="cdl-panel-body">
    <p className="cdl-ui-title">
      Kazandın <span>Bakiyen 120 puan</span>
    </p>
    <ul className="cdl-ui-rewards">
      <li className="is-selected">
        <span>Oyun Jetonu x5</span>
        <span>100 puan</span>
      </li>
      <li>
        <span>Cheesecake İkramı</span>
        <span>280 puan kaldı</span>
      </li>
      <li>
        <span>Bedava Filtre Kahve</span>
        <span>380 puan kaldı</span>
      </li>
    </ul>
    <div className="cdl-ui-coupon">
      <QRCodeSVG value="CAFEDUO-ORNEK-KUPON" size={88} level="M" aria-hidden="true" />
      <span>
        <strong>Kuponun hazır</strong>
        Kasada okut. Bakiyen 20 puana iner.
      </span>
    </div>
  </div>
);

const STATES = [CheckInState, LobbyState, RewardState];

export const LandingFlow: React.FC = () => {
  const [active, setActive] = useState(0);
  const steps = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    steps.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="nasil" className="cdl-flow" aria-labelledby="cdl-flow-title">
      <h2 id="cdl-flow-title" className="cdl-flow-heading" data-landing-reveal>
        Masadan ödüle
      </h2>
      <div className="cdl-flow-copy">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            ref={(node) => {
              steps.current[i] = node;
            }}
            data-step={i}
            className={`cdl-flow-step${active === i ? ' is-active' : ''}`}
          >
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {/* Phones show each state under its own statement instead of pinning one panel. */}
            <div className="cdl-flow-inline cdl-flow-panel" data-ui aria-hidden="true">
              {React.createElement(STATES[i])}
            </div>
          </div>
        ))}
      </div>
      <div className="cdl-flow-stage">
        <div className="cdl-flow-panel" data-ui aria-hidden="true">
          <div className="cdl-panel-head">
            <span>CafeDuo</span>
            <span>MASA05</span>
          </div>
          {STATES.map((State, i) => (
            <div key={i} className="cdl-panel-state" data-active={active === i}>
              <State />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
