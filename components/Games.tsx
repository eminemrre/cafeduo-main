import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Zap, Shuffle, Swords, Shield, Sparkles, Gauge, ArrowUpRight } from 'lucide-react';

interface FeaturedGame {
  title: string;
  subtitle: string;
  duration: string;
  mode: string;
  accent: string;
  icon: React.ReactNode;
  badge: string;
  cta: string;
  disabled?: boolean;
}

const featuredGames: FeaturedGame[] = [
  {
    title: 'Refleks Avı',
    subtitle: 'Ani beliren hedefleri milisaniyeler içinde yakala, zincir kaçırma.',
    duration: '35-45 sn',
    mode: 'Yüksek tempo',
    accent: 'from-cyan-400/90 to-blue-500/90',
    icon: <Zap size={26} />,
    badge: 'Canlı',
    cta: 'Anında başlat',
  },
  {
    title: 'Ritim Kopyala',
    subtitle: 'Işık ve ses dizisini takip et; hata yapmadan komboyu sürdür.',
    duration: '40-55 sn',
    mode: 'Odak + hafıza',
    accent: 'from-fuchsia-400/90 to-violet-500/90',
    icon: <Shuffle size={26} />,
    badge: 'Yeni',
    cta: 'Sıralamaya gir',
  },
  {
    title: 'Duo Hafıza',
    subtitle: 'Kart eşleşmelerini rakibinden önce tamamla, hata puanını düşük tut.',
    duration: '45 sn',
    mode: 'Zihin oyunu',
    accent: 'from-amber-400/90 to-orange-500/90',
    icon: <Shield size={26} />,
    badge: 'Canlı',
    cta: 'Düelloya katıl',
  },
  {
    title: 'Arena Düellosu',
    subtitle: 'Tek hamlede karar verilen kısa 1v1 turu. Çok yakında.',
    duration: '55 sn',
    mode: '1v1 baskı',
    accent: 'from-slate-500/90 to-slate-700/90',
    icon: <Swords size={26} />,
    badge: 'Yakında',
    cta: 'Açılış bekleniyor',
    disabled: true,
  },
];

const GameCard: React.FC<FeaturedGame> = ({ title, subtitle, duration, mode, accent, icon, badge, cta, disabled }) => (
  <motion.article
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5 }}
    className={`relative rounded-[1.6rem] border p-6 md:p-7 transition-all ${
      disabled
        ? 'border-slate-700/75 bg-[#090f22]/72'
        : 'border-cyan-300/25 bg-[linear-gradient(170deg,rgba(8,14,30,0.94),rgba(10,24,52,0.88))] hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(0,0,0,0.48)]'
    }`}
  >
    <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${accent} text-white px-3 py-1.5 shadow-lg`}>
      {icon}
      <span className="font-pixel text-[11px] tracking-[0.16em] uppercase">{badge}</span>
    </div>

    <h3 className="mt-5 text-2xl font-display text-white tracking-wide">{title}</h3>
    <p className="mt-3 text-[var(--rf-muted)] leading-relaxed">{subtitle}</p>

    <div className="mt-6 pt-5 border-t border-slate-700/75 flex items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-cyan-300/80">Ortalama süre</p>
        <p className="text-white font-semibold">{duration}</p>
      </div>
      <div className="space-y-1 text-right">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-cyan-300/80">Mod</p>
        <p className="text-white font-semibold">{mode}</p>
      </div>
    </div>

    <div className="mt-5 text-sm font-semibold text-cyan-200 flex items-center gap-2">
      <span>{cta}</span>
      <ArrowUpRight size={16} />
    </div>
  </motion.article>
);

export const Games: React.FC = () => {
  return (
    <section id="games" className="cd-section overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <span className="cd-kicker">Hızlı tüketilen oyunlar</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-display text-white max-w-2xl leading-tight">
              Kısa tur mantığıyla çalışan, tekrar oranı yüksek oyun kütüphanesi.
            </h2>
          </div>
          <div className="cd-panel px-5 py-4 max-w-sm border-cyan-400/25">
            <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Neden bu format?</p>
            <p className="mt-2 text-[var(--rf-muted)]">
              Turlar bir dakikanın altında kalır. Kullanıcı hızlı karar verir, puan döngüsü kesilmez.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {featuredGames.map((game) => (
            <GameCard key={game.title} {...game} />
          ))}
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <div className="cd-panel p-4 flex items-center gap-3 border-cyan-400/20">
            <Timer className="text-cyan-300" size={20} />
            <div>
              <p className="font-semibold text-white">Kısa Seans</p>
              <p className="text-sm text-[var(--rf-muted)]">Her oyun 1 dakikanın altında.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3 border-cyan-400/20">
            <Sparkles className="text-fuchsia-300" size={20} />
            <div>
              <p className="font-semibold text-white">Tekrar Motivasyonu</p>
              <p className="text-sm text-[var(--rf-muted)]">Anlık puan ve ödül geri bildirimi.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3 border-cyan-400/20">
            <Gauge className="text-amber-300" size={20} />
            <div>
              <p className="font-semibold text-white">Denge ve Ölçüm</p>
              <p className="text-sm text-[var(--rf-muted)]">Solo ve rekabetçi modlar aynı ekonomiye bağlı.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
