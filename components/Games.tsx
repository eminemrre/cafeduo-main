import React from 'react';
import { Timer, Zap, Shuffle, Swords, Shield, Sparkles, ArrowUpRight } from 'lucide-react';

interface FeaturedGame {
  title: string;
  subtitle: string;
  duration: string;
  vibe: string;
  accent: string;
  icon: React.ReactNode;
  badge: string;
  disabled?: boolean;
}

const featuredGames: FeaturedGame[] = [
  {
    title: 'REFLEKS AVI',
    subtitle: 'Ekramda aniden beliren hedefleri en hizli sen yakala.',
    duration: '35-50 sn',
    vibe: 'Yuksek tempo',
    accent: 'from-[#1f6f78] to-[#4a9da8]',
    icon: <Zap size={26} />,
    badge: 'Canli',
  },
  {
    title: 'RITIM KOPYALA',
    subtitle: 'Sesi ve isigi takip et, diziyi bozmadan ritmi tam tuttur.',
    duration: '40-60 sn',
    vibe: 'Odak + hafiza',
    accent: 'from-[#be7b43] to-[#d79b57]',
    icon: <Shuffle size={26} />,
    badge: 'Yeni',
  },
  {
    title: 'DUO HAFIZA',
    subtitle: 'Kisa turda kartlari ac, eslesmeleri rakibinden once bitir.',
    duration: '45 sn',
    vibe: 'Zihin oyunu',
    accent: 'from-[#5d6b7d] to-[#8a9aaa]',
    icon: <Shield size={26} />,
    badge: 'Canli',
  },
  {
    title: 'ARENA DUELLOSU',
    subtitle: 'Anlik hamlelerle mini duello turu. Cok yakinda aciliyor.',
    duration: '55 sn',
    vibe: '1v1 baski',
    accent: 'from-[#7a4f37] to-[#9f6a47]',
    icon: <Swords size={26} />,
    badge: 'Yakinda',
    disabled: true,
  },
];

const GameCard: React.FC<FeaturedGame> = ({ title, subtitle, duration, vibe, accent, icon, badge, disabled }) => (
  <article
    className={`relative rounded-[1.6rem] border p-6 md:p-7 transition-all ${
      disabled
        ? 'border-[#d9c5b0] bg-[#f5ece0]/80'
        : 'border-[#d2b89f] bg-white/70 backdrop-blur-sm hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(44,31,20,0.16)]'
    }`}
  >
    <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${accent} text-white px-3 py-1.5 shadow-lg`}>
      {icon}
      <span className="font-pixel text-[11px] tracking-[0.16em] uppercase">{badge}</span>
    </div>

    <h3 className="mt-5 text-2xl font-bold text-[#1f2328]">{title}</h3>
    <p className="mt-3 text-[#54616f] leading-relaxed">{subtitle}</p>

    <div className="mt-6 pt-5 border-t border-[#d9c8b6] flex items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-[#6f7b87]">Ortalama sure</p>
        <p className="text-[#24303b] font-semibold">{duration}</p>
      </div>
      <div className="space-y-1 text-right">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-[#6f7b87]">Tarz</p>
        <p className="text-[#24303b] font-semibold">{vibe}</p>
      </div>
    </div>

    {!disabled && (
      <div className="absolute right-5 top-5 text-[#355163]">
        <ArrowUpRight size={20} />
      </div>
    )}
  </article>
);

export const Games: React.FC = () => {
  return (
    <section id="games" className="cd-section overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <span className="cd-kicker">Hizli tuketilen oyunlar</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-display text-[#1f2328] max-w-2xl">
              Mekanda bekleme suresini etkileşime ceviren oyun kutuphanesi.
            </h2>
          </div>
          <div className="cd-panel px-5 py-4 max-w-sm">
            <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-[#6f7b87]">Neden bu format?</p>
            <p className="mt-2 text-[#54616f]">
              Turler 1 dakikanin altinda kalir. Kullanici tekrar eder, puan dongusu hizlanir.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {featuredGames.map((game) => (
            <GameCard key={game.title} {...game} />
          ))}
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <div className="cd-panel p-4 flex items-center gap-3">
            <Timer className="text-[#1f6f78]" size={20} />
            <div>
              <p className="font-semibold text-[#1f2328]">Kisa Seans</p>
              <p className="text-sm text-[#5c6875]">Her oyun 1 dakikanin altinda.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3">
            <Sparkles className="text-[#be7b43]" size={20} />
            <div>
              <p className="font-semibold text-[#1f2328]">Tekrar Motivasyonu</p>
              <p className="text-sm text-[#5c6875]">Anlik puan ve odul geri bildirimi.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3">
            <Swords className="text-[#5d6b7d]" size={20} />
            <div>
              <p className="font-semibold text-[#1f2328]">Rekabet Dengesi</p>
              <p className="text-sm text-[#5c6875]">Hem solo hem karsilikli akis.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
