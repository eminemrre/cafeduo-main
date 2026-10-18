/**
 * Public landing (/), DESIGN.md "Masa Oyuncakları", Vitrin register: the café table is a toy set
 * and the opponent is the next table. App renders LandingHeader and LandingFooter outside <main>
 * in place of the Navbar and Footer, so "Masaya katıl" and "Giriş yap" stay in reach.
 */
import React from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { useLandingMotion } from '../LandingExperience';
import { ToyStage } from './ToyStage';
import { GAMES, REWARDS, STEPS, toyImage } from './landingContent';

export interface ClubLandingProps {
  isLoggedIn: boolean;
  onJoin: () => void;
  onLogin: () => void;
  onLogout?: () => void;
}

const MotionToggle: React.FC = () => {
  const motion = useLandingMotion();
  if (!motion) return null;
  return (
    <button
      type="button"
      className="cdl-quiet-button"
      onClick={motion.toggle}
      aria-pressed={motion.enabled}
      disabled={motion.reduced}
    >
      {motion.reduced ? 'Hareket azaltıldı' : motion.enabled ? 'Hareketi durdur' : 'Hareketi aç'}
    </button>
  );
};

export const LandingHeader: React.FC<ClubLandingProps> = ({
  isLoggedIn,
  onJoin,
  onLogin,
  onLogout,
}) => (
  <header className="cdl cdl-header">
    <a href="#ust" className="cdl-wordmark" aria-label="CafeDuo, sayfanın başı">
      CafeDuo
    </a>
    <nav className="cdl-header-links" aria-label="Sayfa bölümleri">
      <a href="#oyunlar">Oyunlar</a>
      <a href="#oduller">Ödüller</a>
      <a href="#nasil">Nasıl oynanır</a>
      <Link to="/kafeler">Kafeler için</Link>
    </nav>
    <div className="cdl-header-actions">
      {isLoggedIn ? (
        <button type="button" className="cdl-text-button" onClick={onLogout}>
          Çıkış yap
        </button>
      ) : (
        <button
          type="button"
          className="cdl-text-button"
          data-testid="hero-login-button"
          onClick={onLogin}
        >
          Giriş yap
        </button>
      )}
      <button type="button" className="cdl-pill" onClick={onJoin}>
        {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
      </button>
    </div>
  </header>
);

const Hero: React.FC<ClubLandingProps> = ({ isLoggedIn, onJoin, onLogin }) => (
  <section id="ust" className="cdl-field cdl-hero" aria-label="Ana bölüm">
    <div className="cdl-hero-copy">
      <h1>
        <span>Rakibin</span> <span>yan masada.</span>
      </h1>
      <p>
        Aynı kafedeki biriyle satranç, bilgi yarışı ya da düello oyna. Kazandığın puanı o kafenin
        ödüllerinde harca.
      </p>
      <div className="cdl-actions">
        <button type="button" className="cdl-pill cdl-pill-lg" onClick={onJoin}>
          {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
        </button>
        {!isLoggedIn && (
          <button type="button" className="cdl-text-button" onClick={onLogin}>
            Zaten üyeyim
          </button>
        )}
      </div>
      <MotionToggle />
    </div>
    <ToyStage />
  </section>
);

const Games: React.FC = () => (
  <section id="oyunlar" className="cdl-field cdl-games" aria-labelledby="cdl-games-title">
    <h2 id="cdl-games-title" data-landing-reveal>
      Bir kahvelik oyun
    </h2>
    <p className="cdl-lede" data-landing-reveal>
      Üç oyun, iki oyuncu, bir masa. Her biri kahven soğumadan biter.
    </p>
    <ul className="cdl-stickers">
      {GAMES.map((game, index) => (
        <li
          key={game.id}
          className={`cdl-sticker cdl-sticker-${game.id}`}
          style={{ '--tilt': `${game.tilt}deg`, '--order': index } as React.CSSProperties}
          data-landing-reveal
        >
          <img
            className="cdl-sticker-toy"
            src={toyImage(game.toy)}
            width={720}
            height={720}
            alt={game.toyAlt}
            loading="lazy"
            decoding="async"
          />
          <h3>{game.name}</h3>
          <p>{game.text}</p>
          <p className="cdl-sticker-meta">{game.meta}</p>
        </li>
      ))}
    </ul>
  </section>
);

const Rewards: React.FC = () => (
  <section id="oduller" className="cdl-field cdl-rewards" aria-labelledby="cdl-rewards-title">
    <div className="cdl-rewards-coin" data-landing-reveal>
      <img
        src={toyImage('coin')}
        width={720}
        height={720}
        alt="Üzerinde 100 yazan fıstık yeşili oyuncak jeton"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="cdl-rewards-copy">
      <h2 id="cdl-rewards-title" data-landing-reveal>
        Puanın kafede ödüle döner
      </h2>
      <p className="cdl-lede" data-landing-reveal>
        Her yeni üye 100 puanla başlar. Günlük çarktan 15, 50 ya da 250 puan, bazen bir kahve
        çıkar.
      </p>
      <ul className="cdl-reward-list" data-landing-reveal>
        {REWARDS.map((reward) => (
          <li key={reward.name}>
            <span>{reward.name}</span>
            <span className="cdl-points">{reward.cost} puan</span>
          </li>
        ))}
      </ul>
      <p className="cdl-note">Ödülleri her kafe kendisi belirler; bunlar başlangıç kataloğu.</p>
    </div>
    <figure className="cdl-coupon" data-landing-reveal>
      <QRCodeSVG value="CAFEDUO-ORNEK-KUPON" size={96} level="M" aria-hidden="true" />
      <figcaption>
        <strong>Kupon kasada okutulur</strong>
        <span>Örnek kupon. Gerçeği ödülü aldığında panelinde çıkar.</span>
      </figcaption>
    </figure>
  </section>
);

const Steps: React.FC = () => (
  <section id="nasil" className="cdl-field cdl-steps" aria-labelledby="cdl-steps-title">
    <h2 id="cdl-steps-title" data-landing-reveal>
      Masaya nasıl oturulur
    </h2>
    <ol>
      {STEPS.map((step) => (
        <li key={step.title} data-landing-reveal>
          <img
            src={toyImage(step.toy)}
            width={720}
            height={720}
            alt={step.toyAlt}
            loading="lazy"
            decoding="async"
          />
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  </section>
);

const Close: React.FC<ClubLandingProps> = ({ isLoggedIn, onJoin, onLogin }) => (
  <section id="katil" className="cdl-field cdl-close" aria-labelledby="cdl-close-title">
    <img
      className="cdl-close-toy"
      src={toyImage('cup')}
      width={720}
      height={720}
      alt=""
      loading="lazy"
      decoding="async"
    />
    <h2 id="cdl-close-title" data-landing-reveal>
      Kahven soğumadan bir el?
    </h2>
    <p className="cdl-lede" data-landing-reveal>
      Hesabını aç, kafende check-in yap. İlk oyununa 100 puanla başlarsın.
    </p>
    <div className="cdl-actions" data-landing-reveal>
      <button type="button" className="cdl-pill cdl-pill-lg" onClick={onJoin}>
        {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
      </button>
      {!isLoggedIn && (
        <button type="button" className="cdl-text-button" onClick={onLogin}>
          Giriş yap
        </button>
      )}
    </div>
  </section>
);

export const LandingFooter: React.FC = () => (
  <footer className="cdl cdl-footer">
    <p className="cdl-footer-brand">CafeDuo</p>
    <nav aria-label="Alt bağlantılar" className="cdl-footer-links">
      <Link to="/kafeler">Kafeler için</Link>
      <a href="https://instagram.com/cafeduotr" target="_blank" rel="noopener noreferrer">
        Instagram
      </a>
      <a href="https://x.com/cafeduotr" target="_blank" rel="noopener noreferrer">
        X (Twitter)
      </a>
      <a href="mailto:cafeduotr@gmail.com">E-posta</a>
      <Link to="/gizlilik">Gizlilik</Link>
    </nav>
    <p className="cdl-footer-year">© {new Date().getFullYear()} CafeDuo</p>
  </footer>
);

export const ClubLanding: React.FC<ClubLandingProps> = (props) => (
  <div className="cdl">
    <Hero {...props} />
    <Games />
    <Rewards />
    <Steps />
    <Close {...props} />
  </div>
);
