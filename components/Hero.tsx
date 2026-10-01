import React from 'react';
import { useNavigate } from 'react-router';
import { ClubBoardPreview } from './ClubBoardPreview';

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
      <div className="club-spread">
        <div className="club-intro">
          <p className="club-kicker">CafeDuo · Kafenin oyun kulübü</p>
          <h1>
            Bir el <br />
            <em>oynayalım mı?</em>
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
          <p className="club-entry-note">Önce hesabın, sonra kafen ve masan.</p>
          <div className="club-table-note">
            <span aria-hidden="true">↳</span>
            <p>
              Oyunlar aynı kafedeki oyuncular arasında.
              <br />
              Tahtayı denemek için üye olman gerekmiyor.
            </p>
          </div>
        </div>
        <ClubBoardPreview />
      </div>
      <div className="club-index">
        <span>Bu masada</span>
        <span>Satranç / Bilgi Yarışı / Nişancı Düellosu</span>
        <a href="#games" className="riso-focus">
          Oyunlara bak ↓
        </a>
      </div>
    </section>
  );
};
