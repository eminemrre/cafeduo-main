import React from 'react';
import { ArrowUpRight, Brain, Crown, Crosshair, Gauge, Sparkles, Timer } from 'lucide-react';
import { RevealGroup, RevealItem } from './ui';

const games = [
  {
    title: 'Retro Satranç',
    text: 'Bir hamle öne geç. Rakibini düşün, tahtaya kendi imzanı bırak.',
    duration: '3+2 / 5+0',
    mode: 'Strateji',
    tone: 'bg-riso-mustard text-carbon',
    icon: Crown,
    cta: 'Tahtaya geç',
  },
  {
    title: 'Bilgi Sprinti',
    text: 'Bildiklerini yarıştır. Sorular hızlı, doğru cevaplar daha da hızlı.',
    duration: '45–60 sn',
    mode: 'Bilgi',
    tone: 'bg-riso-blue text-paper',
    icon: Brain,
    cta: 'Sprinti aç',
  },
  {
    title: 'Nişancı Düellosu',
    text: 'Nefesini tut, anı yakala. Reflekslerini dostça bir düelloda sına.',
    duration: '60–90 sn',
    mode: 'Refleks',
    tone: 'bg-riso-pink text-carbon',
    icon: Crosshair,
    cta: 'Düelloya başla',
  },
];

export const Games: React.FC<{ onPlayClick?: () => void }> = ({ onPlayClick }) => (
  <section id="games" className="duo-landing-section riso-kantin" aria-label="Oyunlar">
    <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
      <div className="duo-section-heading">
        <span className="duo-eyebrow mb-4">KISA TURLAR. BÜYÜK REKABET.</span>
        <h2 data-testid="games-main-heading">
          Bugün hangi <br />
          <span className="text-riso-pink-deep">moddasın?</span>
        </h2>
        <p>Strateji, bilgi ya da refleks. Kahvenin yanına bir oyun seç.</p>
      </div>
      <RevealGroup className="grid gap-5 md:grid-cols-3">
        {games.map(({ title, text, duration, mode, tone, icon: Icon, cta }) => (
          <RevealItem key={title}>
            <button
              type="button"
              className="duo-game-card riso-focus w-full text-left"
              onClick={onPlayClick}
              disabled={!onPlayClick}
              aria-label={`${title} - ${cta}`}
            >
              <div className={`duo-game-card-art ${tone}`} aria-hidden="true">
                <Icon />
              </div>
              <div className="duo-game-card-body">
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="duo-game-card-meta">
                  <span>{duration}</span>
                  <span>{mode}</span>
                </div>
                <div className="duo-game-card-cta">
                  <span>{cta}</span>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </button>
          </RevealItem>
        ))}
      </RevealGroup>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {[
          { icon: Timer, title: 'Beklerken Oyna', text: 'Molanı küçük bir maceraya çevir.' },
          { icon: Sparkles, title: 'Anlık Kazanç', text: 'Oyun puanlarını profilinde takip et.' },
          { icon: Gauge, title: 'Kafe Bağı', text: 'Sevdiğin kafede yeni bir buluşma sebebi.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 items-start border-t border-carbon/15 pt-5">
            <Icon size={21} className="mt-1 text-riso-pink-deep shrink-0" />
            <div>
              <h3 className="font-semibold text-base">{title}</h3>
              <p className="text-sm mt-1 text-carbon-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
