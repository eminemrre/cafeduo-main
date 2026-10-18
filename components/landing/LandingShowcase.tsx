/**
 * The dark row: true-size fragments of the three games and of the reward side. The centred
 * panel is lit in the product's light theme; the others stay in its dark theme. The row
 * scrolls sideways with snap points, by swipe, wheel, drag-free scroll or the two buttons.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const ChessPanel = () => (
  <div className="cdl-show-body">
    <div className="cdl-show-row">
      <span>Sen</span>
      <strong className="cdl-show-clock">2:41</strong>
    </div>
    <div className="cdl-show-row">
      <span>MASA07</span>
      <strong className="cdl-show-clock is-running">2:58</strong>
    </div>
    <div className="cdl-show-chips">
      <span className="is-on">3+2</span>
      <span>5+0</span>
    </div>
    <p className="cdl-show-line">Son hamle: 12. Bxe6 fxe6</p>
  </div>
);

const QuizPanel = () => (
  <div className="cdl-show-body">
    <div className="cdl-show-row">
      <span>Soru 4 / 10</span>
      <strong>8 sn</strong>
    </div>
    <p className="cdl-show-question">Saat Kulesi hangi meydanda?</p>
    <ul className="cdl-show-options">
      <li className="is-on">Konak</li>
      <li>Gündoğdu</li>
      <li>Cumhuriyet</li>
      <li>Basmane</li>
    </ul>
    <p className="cdl-show-line">Sen 3, MASA07 2</p>
  </div>
);

const AimPanel = () => (
  <div className="cdl-show-body">
    <div className="cdl-show-row">
      <span>Tur 2 / 5</span>
      <strong>Merkez +3</strong>
    </div>
    <svg className="cdl-show-target" viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="80" r="70" />
      <circle cx="80" cy="80" r="46" />
      <circle cx="80" cy="80" r="22" />
      <path d="M80 4v40M80 116v40M4 80h40M116 80h40" />
      <circle className="cdl-show-hit" cx="84" cy="77" r="5" />
    </svg>
    <p className="cdl-show-line">Sen 7 isabet, MASA07 5 isabet</p>
  </div>
);

const WHEEL = ['15', '50', '250', 'Kahve'];
const WheelPanel = () => (
  <div className="cdl-show-body">
    <div className="cdl-show-row">
      <span>Günlük çark</span>
      <strong>Bugün 1 hak</strong>
    </div>
    <svg className="cdl-show-wheel" viewBox="0 0 160 160" aria-hidden="true">
      {WHEEL.map((label, i) => {
        const a = (i * Math.PI) / 2;
        const b = ((i + 1) * Math.PI) / 2;
        const p = (r: number, t: number) => `${80 + r * Math.sin(t)} ${80 - r * Math.cos(t)}`;
        return (
          <g key={label}>
            <path d={`M80 80 L${p(72, a)} A72 72 0 0 1 ${p(72, b)} Z`} data-slice={i} />
            <text x={80 + 44 * Math.sin(a + Math.PI / 4)} y={84 - 44 * Math.cos(a + Math.PI / 4)}>
              {label}
            </text>
          </g>
        );
      })}
      <circle cx="80" cy="80" r="10" />
    </svg>
    <p className="cdl-show-line">15, 50 ya da 250 puan; bazen bir kahve.</p>
  </div>
);

const DEPARTMENTS = ['Tüm bölümler', 'Bilgisayar Mühendisliği', 'İşletme', 'Psikoloji'];
const BoardPanel = () => (
  <div className="cdl-show-body">
    <div className="cdl-show-row">
      <span>Sıralama</span>
      <strong>Bu kafe</strong>
    </div>
    <div className="cdl-show-select">Bölüm: Bilgisayar Mühendisliği</div>
    <ul className="cdl-show-menu">
      {DEPARTMENTS.map((item) => (
        <li key={item} className={item === 'Bilgisayar Mühendisliği' ? 'is-on' : undefined}>
          {item}
        </li>
      ))}
    </ul>
    <p className="cdl-show-line">Senin sıran bölümünde gösterilir.</p>
  </div>
);

const PANELS = [
  {
    name: 'Retro Satranç',
    text: 'Gerçek zamanlı, her hamle doğrulanır. 3+2 tempoda bir kahve bitmeden biter.',
    Body: ChessPanel,
  },
  {
    name: 'Bilgi Yarışı',
    text: 'On kısa soru, iki oyuncu. Doğru cevabı en hızlı veren turu alır.',
    Body: QuizPanel,
  },
  {
    name: 'Nişancı Düellosu',
    text: 'Nişangahı merkeze kilitle. Beş turda en çok isabet alan kazanır.',
    Body: AimPanel,
  },
  {
    name: 'Günlük çark',
    text: 'Her gün bir kez çevir. Çıkan puan doğrudan bakiyene eklenir.',
    Body: WheelPanel,
  },
  {
    name: 'Bölüm sıralaması',
    text: 'Kafenin turnuvaları ve sıralaması bölümüne göre süzülür.',
    Body: BoardPanel,
  },
];

export const LandingShowcase: React.FC = () => {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const measure = useCallback(() => {
    const element = row.current;
    if (!element) return;
    const centre = element.scrollLeft + element.clientWidth / 2;
    let nearest = 0;
    let distance = Infinity;
    Array.from(element.children).forEach((child, i) => {
      const panel = child as HTMLElement;
      const gap = Math.abs(panel.offsetLeft + panel.offsetWidth / 2 - centre);
      if (gap < distance) {
        distance = gap;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
    };
    element.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [measure]);

  const go = (index: number) => {
    const element = row.current;
    const panel = element?.children[index] as HTMLElement | undefined;
    if (!element || !panel) return;
    setActive(index);
    const left = panel.offsetLeft + panel.offsetWidth / 2 - element.clientWidth / 2;
    if (typeof element.scrollTo === 'function') element.scrollTo({ left, behavior: 'smooth' });
    else element.scrollLeft = left;
  };

  const current = PANELS[active];
  return (
    <section id="oyunlar" className="cdl-show" aria-labelledby="cdl-show-title">
      <h2 id="cdl-show-title" className="cdl-sr-only">
        Oyunlar ve ödüller
      </h2>
      <div
        ref={row}
        className="cdl-show-row-track"
        role="list"
        aria-label="Oyun ve ödül parçaları"
      >
        {PANELS.map(({ name, Body }, i) => (
          <div
            key={name}
            role="listitem"
            className="cdl-show-panel"
            data-ui
            data-lit={active === i}
            aria-label={name}
            onClick={() => go(i)}
          >
            <p className="cdl-show-name">{name}</p>
            <Body />
          </div>
        ))}
      </div>
      <div className="cdl-show-caption" aria-live="polite">
        <p className="cdl-show-title">{current.name}</p>
        <p>{current.text}</p>
        <div className="cdl-show-controls">
          <button
            type="button"
            onClick={() => go(Math.max(0, active - 1))}
            disabled={active === 0}
          >
            Önceki
          </button>
          <span>
            {active + 1} / {PANELS.length}
          </span>
          <button
            type="button"
            onClick={() => go(Math.min(PANELS.length - 1, active + 1))}
            disabled={active === PANELS.length - 1}
          >
            Sonraki
          </button>
        </div>
      </div>
    </section>
  );
};
