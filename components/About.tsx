import React from 'react';

export const About: React.FC<{ onJoin?: () => void; isLoggedIn?: boolean }> = ({
  onJoin,
  isLoggedIn,
}) => (
  <section id="about" className="club-about" aria-label="Hakkımızda">
    <div className="club-container club-about-layout" data-landing-reveal>
      <span className="club-kicker">Küçük bir kulüp notu</span>
      <div>
        <h2 data-testid="about-main-heading">
          Bir sonraki masada <br />
          <em>kim var?</em>
        </h2>
        <p>
          CafeDuo’yu açınca aynı kafedeki açık oyunları görürsün. Tanıdığın biriyle de
          oynayabilirsin, ilk kez karşılaştığın biriyle de.
        </p>
        <p>
          Puanlar oyundan gelir; ödülleri kafen belirler. Biriktirdiğin puanları ve aldığın ödülleri
          kendi panelinden takip edersin.
        </p>
        <a className="club-about-link riso-focus" href="#features">
          Hesaptan ilk oyuna nasıl geçerim? ↗
        </a>
      </div>
      <aside className="club-members-note">
        <span aria-hidden="true">CD</span>
        <p>
          Kahve masada. <br />
          Oyun telefonda. <br />
          <em>Rakip aynı kafede.</em>
        </p>
      </aside>
    </div>
    {onJoin && (
      <div className="club-container club-last-call" data-landing-reveal>
        <p>
          Bir kahve molası.
          <br />
          <em>Bir sonraki karşılaşma.</em>
        </p>
        <div>
          <button type="button" className="club-join-button riso-focus" onClick={onJoin}>
            {isLoggedIn ? 'Paneline geç' : 'Masaya katıl'}
            <span aria-hidden="true">↗</span>
          </button>
          <span>Hesabınla başla. Kafede buluşalım.</span>
        </div>
      </div>
    )}
  </section>
);
