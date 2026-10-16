import React, { useRef } from 'react';
import { useNavigate } from 'react-router';
import { ClubBoardPreview } from './ClubBoardPreview';
import { CafeScene3D } from './CafeScene3D';
import { ScrollMarquee } from './ScrollMarquee';
import { SplitWords } from './ui/SplitWords';

const chapters = [
  {
    title: 'Kahveni al',
    text: 'Kafene gel, masana otur. Konumla ya da masadaki kodla kafeye bağlan.',
  },
  {
    title: 'Oyuna katıl',
    text: 'Aynı kafedeki açık bir oyuna gir ya da kendi masanı kur: satranç, bilgi yarışı, nişancı düellosu.',
  },
  {
    title: 'Ödülünü seç',
    text: 'Kazandıkça puan biriktir. Puanlarını kafenin belirlediği ödüllerde kullan.',
  },
];

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  onLogin,
  onRegister,
  isLoggedIn,
  userRole,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const steps = useRef<HTMLOListElement>(null);
  const enter = () => {
    if (!isLoggedIn) return onRegister();
    navigate(isAdmin ? '/admin' : userRole === 'cafe_admin' ? '/cafe-admin' : '/dashboard');
  };
  return (
    <section id="home" aria-label="Ana bölüm" className="club-home" data-landing-track>
      <div className="club-spread club-spread-3d club-story">
        <div className="club-intro-wrap" data-landing-track>
          <div className="club-intro">
            <div className="club-hero-meta">
              <p className="club-kicker">CafeDuo · Kafenin oyun kulübü</p>
            </div>
            <h1>
              <span className="club-h1-line" data-depth="5">
                <SplitWords text="Bir el" />
              </span>{' '}
              <br />
              <em data-depth="12">
                <SplitWords text="oynayalım mı?" start={2} />
                <svg className="club-headline-underline" viewBox="0 0 500 25" aria-hidden="true">
                  <path d="M4 14C117 0 289 1 491 10M81 22C192 10 331 8 438 15" />
                </svg>
              </em>
            </h1>
            <p className="club-intro-copy">
              Kafedeki bir masayla eşleş. Satranç oyna, bilgini yarıştır ya da düelloya katıl.
              Kazandığın puanları kafenin ödüllerinde kullan.
            </p>
            <div className="club-join">
              <button
                type="button"
                className="club-join-button riso-focus"
                data-magnetic
                onClick={enter}
                aria-label={isLoggedIn ? 'Kontrol paneline git' : 'Kayıt ol ve oyuna başla'}
              >
                {isLoggedIn ? 'Panele Geç' : 'Masaya katıl'}
                <span aria-hidden="true">↗</span>
              </button>
              {!isLoggedIn && (
                <button
                  type="button"
                  className="club-login riso-focus"
                  data-testid="hero-login-button"
                  onClick={onLogin}
                  aria-label="Oturum aç"
                >
                  Zaten üyeyim
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="club-story-stage">
          <div className="club-scene-slot" data-depth="-10">
            <CafeScene3D story={steps} />
          </div>
        </div>
        <ol ref={steps} className="club-story-steps" aria-label="CafeDuo'da bir mola">
          {chapters.map(({ title, text }, index) => (
            <li key={title} className="club-story-step" data-story-step data-landing-track>
              <div className="club-story-card">
                <span className="club-story-index" aria-hidden="true">
                  0{index + 1}
                </span>
                <h2 data-landing-reveal>
                  <SplitWords text={title} />
                </h2>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="club-index">
        <span>Bu masada</span>
        <ScrollMarquee
          label="Satranç / Bilgi Yarışı / Nişancı Düellosu"
          items={['Satranç', 'Bilgi Yarışı', 'Nişancı Düellosu', 'Kahve molası', 'Puan', 'Ödül']}
        />
        <a href="#games" className="riso-focus">
          Oyunlara bak ↓
        </a>
      </div>
      <div className="club-demo-section" data-landing-track>
        <div className="club-demo-copy">
          <h2>
            Tahta açık.
            <br />
            <em>Sıra sende.</em>
          </h2>
          <p>Kahven soğumadan bir açılış yap. İlk hamleni burada dene; kafende oyuna devam et.</p>
        </div>
        <div className="club-board-scene">
          <div className="club-scene-halo" aria-hidden="true" />
          <div className="club-scene-stamp" aria-hidden="true">
            <span>CD</span>
            <small>
              Bir masa.
              <br />
              İki oyuncu.
            </small>
          </div>
          <div className="club-scene-ticket" aria-hidden="true">
            <span>☕</span>
            <span>
              Kahve masada.
              <br />
              <em>Sıra sende.</em>
            </span>
          </div>
          <ClubBoardPreview />
        </div>
      </div>
    </section>
  );
};
