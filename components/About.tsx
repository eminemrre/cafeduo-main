import React from 'react';

export const About: React.FC = () => (
  <section id="about" className="club-about" aria-label="Hakkımızda">
    <div className="club-container club-about-layout">
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
  </section>
);
