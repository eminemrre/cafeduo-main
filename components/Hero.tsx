import React from 'react';
import { useNavigate } from 'react-router';
import { LandingMotionControl } from './LandingExperience';
import { ClubBoardPreview } from './ClubBoardPreview';
import { CafeScene3D } from './CafeScene3D';

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
  const enter = () => {
    if (!isLoggedIn) return onRegister();
    navigate(isAdmin ? '/admin' : userRole === 'cafe_admin' ? '/cafe-admin' : '/dashboard');
  };
  return (
    <section id="home" aria-label="Ana bölüm" className="club-home">
      <div className="club-spread club-spread-3d">
        <div className="club-intro">
          <div className="club-hero-meta">
            <p className="club-kicker">CafeDuo · Kafenin oyun kulübü</p>
            <LandingMotionControl />
          </div>
          <h1>
            Bir el <br />
            <em>
              oynayalım mı?
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
        <CafeScene3D />
      </div>
      <div className="club-index">
        <span>Bu masada</span>
        <span>Satranç / Bilgi Yarışı / Nişancı Düellosu</span>
        <a href="#games" className="riso-focus">
          Oyunlara bak ↓
        </a>
      </div>
      <div className="club-demo-section">
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
