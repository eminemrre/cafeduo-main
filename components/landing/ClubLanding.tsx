/**
 * Public landing (/): the café table MASA07 is the opponent in a working chess fragment, and
 * each of its replies brings an İzmir district into focus as the place where that table sits.
 * "Masaya katıl" and "Giriş yap" stay in the sticky header at every width. App renders
 * LandingHeader and LandingFooter outside <main> in place of the Navbar and Footer.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLandingMotion } from '../LandingExperience';
import { TableMatchBoard } from './TableMatchBoard';
import { LandingFlow } from './LandingFlow';
import { LandingShowcase } from './LandingShowcase';
import {
  BAY_VIDEO,
  CREDITS,
  DISTRICT_GROUPS,
  HERO_DISTRICTS,
  photoSrc,
} from './landingContent';

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
      className="cdl-text-button"
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
      <a href="#nasil">Nasıl oynanır</a>
      <a href="#oyunlar">Oyunlar</a>
      <a href="#semtler">Semtler</a>
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
      <button type="button" className="cdl-button" onClick={onJoin}>
        {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
      </button>
    </div>
  </header>
);

const Hero: React.FC<ClubLandingProps> = ({ isLoggedIn, onJoin, onLogin }) => {
  const motion = useLandingMotion();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const replies = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const district = HERO_DISTRICTS[index];

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    // Warm the next picture so the following reply never waits on the network.
    const next = HERO_DISTRICTS[(index + 1) % HERO_DISTRICTS.length];
    const image = new Image();
    image.src = photoSrc(next, 1600);
  }, [index]);

  const onReply = () => {
    const next = replies.current === 0 ? 0 : (index + 1) % HERO_DISTRICTS.length;
    replies.current += 1;
    window.clearTimeout(timer.current);
    setIndex(next);
    if (next !== index) setRevealed(false);
    timer.current = window.setTimeout(() => setRevealed(true), motion?.enabled ? 380 : 0);
  };
  const onReset = () => {
    window.clearTimeout(timer.current);
    replies.current = 0;
    setIndex(0);
    setRevealed(false);
  };

  return (
    <section id="ust" className="cdl-hero" aria-label="Ana bölüm">
      <div className="cdl-hero-copy">
        <h1 data-landing-reveal>
          Yan masayla oyna.
          <br />
          Kafede harca.
        </h1>
        <p data-landing-reveal>
          İzmir’de aynı kafedeki biriyle satranç, bilgi yarışı ya da düello oyna. Kazandığın puanı
          o kafenin ödüllerinde kullan.
        </p>
        <div className="cdl-hero-actions" data-landing-reveal>
          <button type="button" className="cdl-button" onClick={onJoin}>
            {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
          </button>
          {!isLoggedIn && (
            <button type="button" className="cdl-text-button" onClick={onLogin}>
              Zaten üyeyim
            </button>
          )}
        </div>
        <div className="cdl-hero-motion">
          <MotionToggle />
        </div>
      </div>
      <div className="cdl-stage" data-revealed={revealed}>
        <div className="cdl-stage-photo" aria-hidden="true">
          <img
            key={district.id}
            src={photoSrc(district, 1600)}
            srcSet={`${photoSrc(district, 720)} 720w, ${photoSrc(district, 1600)} 1600w`}
            sizes="(max-width: 768px) 100vw, 70vw"
            width={district.width}
            height={district.height}
            alt=""
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
        </div>
        <span className="cdl-sr-only" aria-live="polite">
          {revealed ? `Fotoğraf netleşti: ${district.alt}.` : ''}
        </span>
        <div className="cdl-stage-fragment">
          <TableMatchBoard
            district={district}
            revealed={revealed}
            onReply={onReply}
            onReset={onReset}
          />
        </div>
      </div>
    </section>
  );
};

const Districts: React.FC = () => (
  <section id="semtler" className="cdl-list" aria-labelledby="cdl-list-title">
    <div className="cdl-list-column">
      <h2 id="cdl-list-title" data-landing-reveal>
        Sıradaki masa nerede?
      </h2>
      <p className="cdl-list-intro" data-landing-reveal>
        Ortak kafe listesi hazırlanıyor. Bu satırlar kafeleri değil, CafeDuo’nun açılacağı İzmir
        semtlerini gösterir.
      </p>
      {DISTRICT_GROUPS.map((group) => (
        <div key={group.title} className="cdl-list-group" data-landing-reveal>
          <h3>{group.title}</h3>
          <ul>
            {group.rows.map((row) => (
              <li key={row.name}>
                {row.photo ? (
                  <img
                    src={photoSrc(row.photo, 64)}
                    width={16}
                    height={16}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="cdl-dot" style={{ background: row.dot }} aria-hidden="true" />
                )}
                <span className="cdl-list-name">{row.name}</span>
                <span className="cdl-list-value">{row.place}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="cdl-list-group" data-landing-reveal>
        <h3 id="gorseller">Görseller</h3>
        <ul>
          {CREDITS.map((credit) => (
            <li key={credit.source}>
              {credit.thumb ? (
                <img
                  src={credit.thumb}
                  width={16}
                  height={16}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="cdl-dot" style={{ background: '#1a4be0' }} aria-hidden="true" />
              )}
              <a
                className="cdl-list-name"
                href={credit.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                {credit.label}, {credit.creator}
              </a>
              <span className="cdl-list-value">{credit.licence}</span>
            </li>
          ))}
        </ul>
        <p className="cdl-list-note">
          Wikimedia Commons’tan, lisanslarına göre kullanıldı. Semtleri gösterir; hiçbiri CafeDuo’nun
          ortak kafesi değildir.
        </p>
      </div>
    </div>
  </section>
);

const Close: React.FC<ClubLandingProps> = ({ isLoggedIn, onJoin, onLogin }) => {
  const motion = useLandingMotion();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // jsdom and some browsers lack play() or return no promise; the poster stays in place.
    if (motion?.running) {
      const playing = typeof element.play === 'function' ? element.play() : undefined;
      if (playing) playing.catch((): void => undefined);
    } else if (typeof element.pause === 'function') element.pause();
  }, [motion?.running]);

  return (
    <section id="katil" className="cdl-close" aria-labelledby="cdl-close-title">
      <div className="cdl-tile cdl-tile-media" aria-hidden="true">
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="metadata"
          poster={BAY_VIDEO.poster}
          width={854}
          height={480}
        >
          <source src={BAY_VIDEO.src} type="video/webm" />
        </video>
      </div>
      <div className="cdl-tile cdl-tile-action" data-landing-reveal>
        <h2 id="cdl-close-title">Masan 100 puanla açılır.</h2>
        <p>
          Hesabını aç, kafende check-in yap. İlk oyununa her yeni üye gibi 100 puanla başlarsın.
        </p>
        <div className="cdl-close-actions">
          <button type="button" className="cdl-button is-paper" onClick={onJoin}>
            {isLoggedIn ? 'Panele geç' : 'Masaya katıl'}
          </button>
          {!isLoggedIn && (
            <button type="button" className="cdl-text-button is-paper" onClick={onLogin}>
              Giriş yap
            </button>
          )}
        </div>
      </div>
      <div className="cdl-tile cdl-tile-field" aria-hidden="true" />
    </section>
  );
};

export const LandingFooter: React.FC = () => (
  <footer className="cdl cdl-footer">
    <p>CafeDuo, kafede oyun kulübü</p>
    <nav aria-label="Alt bağlantılar" className="cdl-footer-links">
      <Link to="/kafeler">Kafeler için</Link>
      <a href="https://instagram.com/cafeduotr" target="_blank" rel="noopener noreferrer">
        Instagram
      </a>
      <a href="https://x.com/cafeduotr" target="_blank" rel="noopener noreferrer">
        X (Twitter)
      </a>
      <a href="mailto:cafeduotr@gmail.com">E-posta</a>
      <a href="#gorseller">Görseller</a>
    </nav>
    <p className="cdl-footer-end">
      <span>© {new Date().getFullYear()}</span>
      <Link to="/gizlilik">Gizlilik</Link>
    </p>
  </footer>
);

export const ClubLanding: React.FC<ClubLandingProps> = (props) => (
  <div className="cdl">
    <Hero {...props} />
    <LandingFlow />
    <LandingShowcase />
    <Districts />
    <Close {...props} />
  </div>
);
