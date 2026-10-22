/**
 * Public landing (/). Direction: "the page is the object" (taste-skill draw, seed 1485260991) —
 * the page is the stationery of the café table, with the table tent as its first screen.
 * DESIGN.md "Masa Oyuncakları", Vitrin register. App renders LandingHeader and LandingFooter
 * around <main>; the footer is the back of the box, built from coloured blocks.
 */
import React, { useState } from 'react';
import { Link } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ToyStage } from './ToyStage';
import {
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  GAMES,
  MENU,
  SHOWCASE_TABS,
  SLIP,
  SLIP_RESULT,
  toyImage,
} from './landingContent';

export interface LandingPageProps {
  isLoggedIn: boolean;
  /** Opens the sign-up modal; the landing's sentence passes the typed e-mail along. */
  onJoin: (email?: string) => void;
  onLogin: () => void;
  onLogout?: () => void;
}

const isInternal = (href: string) => href.startsWith('/');

export interface LandingHeaderProps extends LandingPageProps {
  /** The page the header sits on: the player landing (/) or the café-owner landing (/kafeler). */
  page?: 'players' | 'owners';
  /** The owner page's primary action goes to WhatsApp instead of the sign-up modal. */
  ownerActionHref?: string;
}

const HEADER_LINKS = {
  players: [
    { label: 'Oyunlar', href: '#oyunlar' },
    { label: 'Ödüller', href: '#oduller' },
    { label: 'Kafeler için', href: '/kafeler' },
  ],
  owners: [
    { label: 'Nasıl işler', href: '#nasil-calisir' },
    { label: 'Fiyat', href: '#fiyat' },
    { label: 'Oyuncular için', href: '/' },
  ],
} as const;

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  isLoggedIn,
  onJoin,
  onLogin,
  onLogout,
  page = 'players',
  ownerActionHref,
}) => (
  <header className="cdl cdl-header">
    <a href="#ust" className="cdl-wordmark" aria-label="CafeDuo, sayfanın başı">
      CafeDuo
    </a>
    <nav className="cdl-nav" aria-label="Sayfa bölümleri">
      {HEADER_LINKS[page].map((link) =>
        isInternal(link.href) ? (
          <Link key={link.href} to={link.href}>
            {link.label}
          </Link>
        ) : (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        )
      )}
    </nav>
    <div className="cdl-header-actions">
      {isLoggedIn ? (
        <button type="button" className="cdl-quiet" onClick={onLogout}>
          Çıkış yap
        </button>
      ) : (
        <button
          type="button"
          className="cdl-quiet"
          data-testid="hero-login-button"
          onClick={onLogin}
        >
          Giriş yap
        </button>
      )}
      {page === 'owners' && ownerActionHref ? (
        <a className="cdl-button" href={ownerActionHref} target="_blank" rel="noopener noreferrer">
          Pilota başvur
        </a>
      ) : (
        <button type="button" className="cdl-button" onClick={() => onJoin()}>
          {isLoggedIn ? 'Panele geç' : 'Kaydol'}
        </button>
      )}
    </div>
  </header>
);

/** The table tent: the artefact the whole page is made of. Cropped by the fold on purpose. */
const Hero: React.FC = () => (
  <section id="ust" className="cdl-field cdl-hero" aria-labelledby="cdl-hero-title">
    <div className="cdl-tent">
      <div className="cdl-tent-stack">
        <div className="cdl-tent-card" data-landing-reveal>
          <i className="cdl-scallop cdl-scallop-tl" aria-hidden="true" />
          <i className="cdl-scallop cdl-scallop-tr" aria-hidden="true" />
          <h1 id="cdl-hero-title">
            <span className="cdl-tent-line-1">Rakibin</span>{' '}
            <span className="cdl-tent-line-2">yan masada.</span>
          </h1>
          <p className="cdl-tent-offer">
            Aynı kafedeki biriyle satranç, bilgi yarışı, düello ya da amiral battı oyna; kazandığın
            puanı kafenin ödüllerinde harca.
          </p>
          <p className="cdl-tent-meta">
            <span>İlk 100 puan hediye</span>
            <i className="cdl-diamond" aria-hidden="true" />
            <span>Her gün çark</span>
          </p>
          <div className="cdl-tent-foot">
            <div className="cdl-tent-qr">
              <QRCodeSVG
                value="https://cafeduotr.com"
                size={92}
                level="M"
                fgColor="#17140F"
                aria-hidden="true"
              />
            </div>
            <p className="cdl-tent-scan">Telefonla okut: cafeduotr.com</p>
          </div>
        </div>
      </div>
    </div>
    <nav className="cdl-hero-links" aria-label="Sayfa bölümleri">
      <a href="#oyunlar">Oyunlar</a>
      <a href="#oduller">Ödüller</a>
      <Link to="/kafeler">Kafeler için</Link>
    </nav>
    {/* The cup is on this table too: cropped by the fold, set down beside the tent. */}
    <img
      className="cdl-hero-cup"
      src={toyImage('cup')}
      width={720}
      height={720}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  </section>
);

/** How it works, printed as the order slip. */
const Slip: React.FC = () => (
  <section id="nasil" className="cdl-field cdl-slip" aria-labelledby="cdl-slip-title">
    <div className="cdl-slip-copy">
      <h2 id="cdl-slip-title" data-landing-reveal>
        Nasıl işler
      </h2>
      <p data-landing-reveal>
        Kafede check-in yaptığın an masan açılır; aynı mekânda oyun kuran biriyle eşleşirsin.
        Puanlar maç bitince işlenir.
      </p>
    </div>
    <div className="cdl-slip-sheet" data-landing-reveal>
      {SLIP.map((group) => (
        <div className="cdl-slip-group" key={group.label}>
          <h3>{group.label}</h3>
          <ul>
            {group.rows.map((row) => (
              <li className="cdl-slip-row" key={row.what}>
                <span className="cdl-slip-what">{row.what}</span>
                <span className="cdl-slip-dots" aria-hidden="true" />
                <span className="cdl-slip-value">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="cdl-slip-result">
        <span>{SLIP_RESULT.what}</span>
        <span>{SLIP_RESULT.value}</span>
      </p>
    </div>
  </section>
);

/** The games: three colour sheets that stack over each other as the page scrolls. */
const Sheets: React.FC = () => (
  <section id="oyunlar" className="cdl-field cdl-sheets" aria-labelledby="cdl-sheets-title">
    <h2 id="cdl-sheets-title" data-landing-reveal>
      Bir kahvelik oyun
    </h2>
    <ol className="cdl-sheet-stack">
      {GAMES.map((game, index) => (
        <li
          key={game.id}
          className={`cdl-sheet cdl-sheet-${game.id}`}
          style={{ '--sheet-index': index } as React.CSSProperties}
        >
          <div className="cdl-sheet-copy">
            <h3 data-landing-reveal>{game.name}</h3>
            <p data-landing-reveal>{game.text}</p>
          </div>
          <img
            className="cdl-sheet-toy"
            src={toyImage(game.toy)}
            width={720}
            height={720}
            alt={game.toyAlt}
            loading="lazy"
            decoding="async"
            data-landing-reveal
          />
        </li>
      ))}
    </ol>
  </section>
);

/** The live toy table, with what it stands for. */
const Showcase: React.FC<LandingPageProps> = ({ isLoggedIn, onJoin }) => {
  const [active, setActive] = useState<(typeof SHOWCASE_TABS)[number]['id']>('oyun');
  const panel = SHOWCASE_TABS.find((tab) => tab.id === active) ?? SHOWCASE_TABS[0];
  return (
    <section id="vitrin" className="cdl-field cdl-showcase" aria-labelledby="cdl-showcase-title">
      <div className="cdl-showcase-plate">
        <ToyStage />
      </div>
      <div className="cdl-showcase-copy">
        <div className="cdl-tabs" role="group" aria-label="Masa ne gösteriyor">
          {SHOWCASE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="cdl-tab"
              aria-pressed={tab.id === active}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="cdl-showcase-body">
          <h2 id="cdl-showcase-title" data-landing-reveal>
            {panel.title}
          </h2>
          <p data-landing-reveal>{panel.text}</p>
        </div>
        <div className="cdl-showcase-actions">
          <button type="button" className="cdl-cell cdl-cell-primary" onClick={() => onJoin()}>
            {isLoggedIn ? 'Panele geç' : 'Kaydol'}
          </button>
          <Link className="cdl-cell cdl-cell-plain" to="/kafeler">
            Kafeler için
          </Link>
        </div>
      </div>
    </section>
  );
};

/** The reward catalogue as the café's menu. */
const Menu: React.FC = () => (
  <section id="oduller" className="cdl-field cdl-menu" aria-labelledby="cdl-menu-title">
    <div className="cdl-menu-column">
      <h2 id="cdl-menu-title" className="cdl-menu-masthead" data-landing-reveal>
        Menü
      </h2>
      <p className="cdl-menu-note" data-landing-reveal>
        Puanla ödenir; fiyatlar örnektir, ödülleri her kafe kendi belirler. Günlük çarktan 15, 50 ya
        da 250 puan, bazen bir kahve çıkar.
      </p>
      <div className="cdl-menu-bars">
        {MENU.map((group, index) => (
          <details key={group.label} className="cdl-bar" open={index === 0} data-landing-reveal>
            <summary className="cdl-bar-summary">
              <span>{group.label}</span>
              <i className="cdl-bar-mark" aria-hidden="true" />
            </summary>
            <ul className="cdl-bar-items">
              {group.items.map((item) => (
                <li key={item.name}>
                  <span>{item.name}</span>
                  <span className="cdl-bar-cost">{item.cost} puan</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      {/* The coin closes the menu: points are the currency of this page. */}
      <img
        className="cdl-menu-coin"
        src={toyImage('coin')}
        width={720}
        height={720}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    </div>
  </section>
);

/** The close: a sentence with a blank, and the blank is the form. */
const Close: React.FC<LandingPageProps> = ({ onJoin }) => {
  const [email, setEmail] = useState('');
  return (
    <section id="katil" className="cdl-field cdl-cta" aria-label="Kaydol">
      <form
        className="cdl-cta-form"
        onSubmit={(event) => {
          event.preventDefault();
          onJoin(email.trim() || undefined);
        }}
      >
        <p className="cdl-cta-sentence">
          <label htmlFor="cdl-cta-email">İlk 100 puanın için</label>
          <input
            id="cdl-cta-email"
            className="cdl-cta-input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder="e-posta adresin"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="cdl-cta-tail">
            <span>ile</span>
            <button type="submit" className="cdl-cta-submit">
              Kaydol
            </button>
          </span>
        </p>
        <p className="cdl-cta-note" data-landing-reveal>
          Kaydolunca panele geçersin; ilk 100 puan hesabına yüklenir.
        </p>
      </form>
    </section>
  );
};

export const LandingFooter: React.FC = () => (
  <footer className="cdl cdl-footer">
    <p className="cdl-footer-mark" role="img" aria-label="CafeDuo">
      {Array.from('CafeDuo').map((letter, index) => (
        <span key={`${letter}-${index}`} className="cdl-footer-block" aria-hidden="true">
          {letter}
        </span>
      ))}
    </p>
    <div className="cdl-footer-grid">
      {FOOTER_COLUMNS.map((column) => (
        <div className="cdl-footer-col" key={column.label}>
          <h2>{column.label}</h2>
          <ul>
            {column.links.map((link) => (
              <li key={link.label}>
                {isInternal(link.href) && !link.href.includes('#') ? (
                  <Link to={link.href}>{link.label}</Link>
                ) : link.href.startsWith('#') || link.href.startsWith('/#') ? (
                  <a href={link.href}>{link.label}</a>
                ) : (
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="cdl-footer-contact">
        {FOOTER_CONTACT.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
    <div className="cdl-footer-close">
      <p>© {new Date().getFullYear()} CafeDuo</p>
      <a className="cdl-button cdl-button-small" href="#">
        Başa dön
      </a>
    </div>
  </footer>
);

export const LandingPage: React.FC<LandingPageProps> = (props) => (
  <div className="cdl">
    <Hero />
    <Slip />
    <Sheets />
    <Showcase {...props} />
    <Menu />
    <Close {...props} />
  </div>
);
