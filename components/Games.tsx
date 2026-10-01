import React from 'react';

const games = [
  {
    number: '01',
    title: 'Retro Satranç',
    tag: 'Strateji',
    text: 'Tahtada iki kişi. Açılışı kur, rakibinin hamlesini bekle.',
    detail: '3+2 veya 5+0 tempo',
    cta: 'Tahtaya geç',
    mark: '♞',
  },
  {
    number: '02',
    title: 'Bilgi Yarışı',
    tag: 'Bilgi',
    text: 'Aynı sorular, iki oyuncu. Bildiğini doğru zamanda söyle.',
    detail: 'Soru ve cevap',
    cta: 'Yarışmaya katıl',
    mark: '?',
  },
  {
    number: '03',
    title: 'Nişancı Düellosu',
    tag: 'Refleks',
    text: 'Hedefi yakala. Tur sonunda skorlarınız karşılaştırılır.',
    detail: 'İki kişilik düello',
    cta: 'Düelloya başla',
    mark: '↗',
  },
];

export const Games: React.FC<{ onPlayClick?: () => void }> = ({ onPlayClick }) => (
  <section id="games" className="club-games" aria-label="Oyunlar">
    <div className="club-container">
      <div className="club-games-heading">
        <div>
          <span className="club-kicker">Oyun listesi</span>
          <h2 data-testid="games-main-heading">
            Hangisini <br />
            <em>oynuyoruz?</em>
          </h2>
        </div>
        <p>
          Bir masada iki oyuncu. <br />
          Üç farklı karşılaşma.
        </p>
      </div>
      <div className="club-game-list">
        {games.map(({ number, title, tag, text, detail, cta, mark }) => (
          <button
            key={title}
            type="button"
            className="club-game-row riso-focus"
            onClick={onPlayClick}
            disabled={!onPlayClick}
            aria-label={`${title} - ${cta}`}
          >
            <span className="club-game-number">{number}</span>
            <span className="club-game-mark" aria-hidden="true">
              {mark}
            </span>
            <span className="club-game-name">
              <span className="club-game-tag">{tag}</span>
              <h3>{title}</h3>
            </span>
            <span className="club-game-description">
              {text}
              <small>{detail}</small>
            </span>
            <span className="club-game-action">
              {cta}
              <span aria-hidden="true">↗</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  </section>
);
