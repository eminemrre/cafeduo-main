import React, { useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Coffee,
  Crosshair,
  Gamepad2,
  Play,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui';
import { FloatingSquareField } from './FloatingSquareField';
import { ChessPieceIcon } from './games/ChessPieceIcons';

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
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const enter = () => {
    if (!isLoggedIn) return onRegister();
    navigate(isAdmin ? '/admin' : userRole === 'cafe_admin' ? '/cafe-admin' : '/dashboard');
  };

  return (
    <section id="home" aria-label="Ana bölüm" className="duo-hero riso-kantin">
      <div className="duo-hero-grid">
        <div className="duo-hero-copy">
          <p className="duo-eyebrow">
            <span /> KAFENİN YENİ OYUN ALANI
          </p>
          <h1>
            Kahve hazır. <br />
            <span>Oyun başlasın.</span>
          </h1>
          <p className="duo-hero-description">
            Aynı kafe. Yeni rakipler. Masana bağlan, kısa bir oyun oyna ve puanlarını kafenin
            ödüllerine dönüştür.
          </p>
          <div className="duo-hero-actions">
            <Button
              size="lg"
              onClick={enter}
              aria-label={isLoggedIn ? 'Kontrol paneline git' : 'Kayıt ol ve oyuna başla'}
              trailingIcon={<ArrowRight size={19} />}
            >
              {isLoggedIn ? 'Panele Geç' : "CafeDuo'ya Başla"}
            </Button>
            {!isLoggedIn && (
              <button
                type="button"
                className="duo-login-link riso-focus"
                data-testid="hero-login-button"
                onClick={onLogin}
                aria-label="Oturum aç"
              >
                <Play size={15} /> Oturum Aç
              </button>
            )}
          </div>
          <div className="duo-hero-note">
            <Coffee size={17} />
            <span>Kahven soğumadan bir tur daha.</span>
          </div>
          <div className="duo-hero-facts">
            <div>
              <strong>3 oyun</strong>
              <span>Tek bir buluşma noktası</span>
            </div>
            <div>
              <strong>Gerçek ödüller</strong>
              <span>Oynadıkça biriken puanlar</span>
            </div>
          </div>
        </div>
        <div className="duo-hero-scene" ref={sceneRef} aria-label="CafeDuo oyun deneyimi">
          <FloatingSquareField containerRef={sceneRef} />
          <div className="duo-scene-topline">
            <span>
              <Gamepad2 size={16} /> CAFE DUO / PLAY CLUB
            </span>
            <span>01 — 03</span>
          </div>
          <div className="duo-match-poster">
            <div className="duo-poster-header">
              <span>Bir hamleyle başlar.</span>
              <ArrowUpRight size={24} />
            </div>
            <div className="duo-poster-title">
              SIRADAKİ <br />
              <span>HAMLE SENİN.</span>
            </div>
            <div className="duo-chess-art" aria-hidden="true">
              <div className="duo-chess-board">
                {Array.from({ length: 36 }, (_, i) => (
                  <span key={i} className={(Math.floor(i / 6) + i) % 2 ? 'duo-square-blue' : ''} />
                ))}
              </div>
              <div className="duo-hero-knight">
                <ChessPieceIcon type="n" color="w" size={205} />
              </div>
              <div className="duo-hero-pawn">
                <ChessPieceIcon type="p" color="b" size={90} />
              </div>
              <div className="duo-coffee-sticker">
                <Coffee size={33} strokeWidth={1.6} />
                <span>
                  GOOD COFFEE. <br />
                  GREAT GAME.
                </span>
              </div>
              <Sparkles className="duo-art-spark" size={30} />
            </div>
            <div className="duo-poster-footer">
              <span>RETRO SATRANÇ</span>
              <span>STRATEJİ / 3+2 · 5+0</span>
            </div>
          </div>
          <div className="duo-reward-ticket">
            <span className="duo-ticket-icon">
              <Sparkles size={21} />
            </span>
            <div>
              <strong>İyi oyun, güzel ödül.</strong>
              <span>Puanlarını kafenin ödüllerine dönüştür.</span>
            </div>
            <ArrowUpRight size={21} />
          </div>
          <div className="duo-scene-caption">
            <span>OYNA. TANIŞ. TEKRAR GEL.</span>
            <span>Önizleme</span>
          </div>
        </div>
      </div>
      <div className="duo-game-strip" aria-label="Oyun seçenekleri">
        <span className="duo-game-strip-label">MOLANIN MODUNU SEÇ</span>
        <button type="button" onClick={enter}>
          <ChessPieceIcon type="n" color="b" size={27} />
          <span>Retro Satranç</span>
          <ArrowUpRight size={16} />
        </button>
        <button type="button" onClick={enter}>
          <Brain size={23} />
          <span>Bilgi Sprinti</span>
          <ArrowUpRight size={16} />
        </button>
        <button type="button" onClick={enter}>
          <Crosshair size={23} />
          <span>Nişancı Düellosu</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  );
};
