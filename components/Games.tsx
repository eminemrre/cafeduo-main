import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Zap, Swords, Brain, Crown, Sparkles, Gauge, ArrowUpRight } from 'lucide-react';

interface FeaturedGame {
  title: string;
  subtitle: string;
  duration: string;
  mode: string;
  accent: string;
  tone: string;
  grid: string;
  glow: string;
  icon: React.ReactNode;
  badge: string;
  cta: string;
  disabled?: boolean;
}

const featuredGames: FeaturedGame[] = [
  {
    title: 'Neon Refleks',
    subtitle: 'Beliren hedefleri en hızlı yakala; seri korudukça puanın katlansın.',
    duration: '35-45 sn',
    mode: 'Arcade tempo',
    accent: 'from-cyan-400/90 to-blue-500/90',
    tone: 'radial-gradient(circle at 16% 22%, rgba(34, 213, 238, 0.26), transparent 42%), radial-gradient(circle at 88% 6%, rgba(34, 99, 255, 0.22), transparent 38%), linear-gradient(152deg, rgba(7, 18, 40, 0.96), rgba(9, 33, 72, 0.88))',
    grid: 'rgba(34, 213, 238, 0.08)',
    glow: 'rgba(34, 213, 238, 0.25)',
    icon: <Zap size={26} />,
    badge: 'Refleks',
    cta: 'Reflekse gir',
  },
  {
    title: 'Pixel Düello',
    subtitle: 'Hamle sırasını doğru yönet, baskıyı kaybetmeden turu kapat.',
    duration: '40-55 sn',
    mode: 'Retro savaş',
    accent: 'from-fuchsia-400/90 to-violet-500/90',
    tone: 'radial-gradient(circle at 18% 20%, rgba(251, 113, 133, 0.23), transparent 42%), radial-gradient(circle at 85% 10%, rgba(129, 140, 248, 0.22), transparent 40%), linear-gradient(152deg, rgba(12, 16, 42, 0.96), rgba(31, 19, 68, 0.88))',
    grid: 'rgba(251, 113, 133, 0.08)',
    glow: 'rgba(192, 132, 252, 0.25)',
    icon: <Swords size={26} />,
    badge: 'Savaş',
    cta: 'Düelloya başla',
  },
  {
    title: 'Retro Satranç',
    subtitle: 'Gerçek zamanlı satrançta hamleni temiz oyna, süreyi doğru yönet.',
    duration: '3+2 / 5+0',
    mode: 'Strateji',
    accent: 'from-amber-400/90 to-orange-500/90',
    tone: 'radial-gradient(circle at 12% 18%, rgba(251, 191, 36, 0.22), transparent 40%), radial-gradient(circle at 82% 8%, rgba(251, 146, 60, 0.22), transparent 36%), linear-gradient(152deg, rgba(20, 17, 41, 0.96), rgba(53, 32, 76, 0.88))',
    grid: 'rgba(251, 191, 36, 0.09)',
    glow: 'rgba(251, 191, 36, 0.25)',
    icon: <Crown size={26} />,
    badge: 'Strateji',
    cta: 'Tahtaya geç',
  },
  {
    title: 'Bilgi Sprinti',
    subtitle: 'Rastgele sorularda hız ve doğrulukla rakibini geride bırak.',
    duration: '45-60 sn',
    mode: 'Quiz modu',
    accent: 'from-emerald-400/90 to-teal-500/90',
    tone: 'radial-gradient(circle at 14% 20%, rgba(74, 222, 128, 0.2), transparent 40%), radial-gradient(circle at 86% 12%, rgba(16, 185, 129, 0.22), transparent 36%), linear-gradient(152deg, rgba(8, 24, 44, 0.96), rgba(8, 40, 63, 0.88))',
    grid: 'rgba(45, 212, 191, 0.08)',
    glow: 'rgba(52, 211, 153, 0.24)',
    icon: <Brain size={26} />,
    badge: 'Bilgi',
    cta: 'Sprinti aç',
  },
];

const GameCard: React.FC<FeaturedGame> = ({ title, subtitle, duration, mode, accent, tone, grid, glow, icon, badge, cta, disabled }) => (
  <motion.article
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5 }}
    whileHover={disabled ? {} : { y: -8, rotateX: 2, rotateY: -2 }}
    style={!disabled ? { backgroundImage: tone } : undefined}
    className={`relative rounded-[1.6rem] border p-6 md:p-7 transition-all ${
      disabled
        ? 'border-cyan-900/45 bg-[#090f22]/72'
        : 'group border-cyan-300/25 hover:shadow-[0_22px_56px_rgba(0,0,0,0.5)]'
    }`}
  >
    {!disabled && (
      <>
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full blur-3xl"
          style={{ backgroundColor: glow }}
        />
      </>
    )}

    {!disabled && (
      <motion.div
        className="pointer-events-none absolute -left-24 top-0 h-24 w-52 -rotate-12 bg-cyan-300/20 blur-2xl"
        animate={{ x: ['0%', '220%'] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    )}

    <div className={`relative z-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${accent} text-white px-3 py-1.5 shadow-lg`}>
      {icon}
      <span className="font-pixel text-[11px] tracking-[0.16em] uppercase">{badge}</span>
    </div>

    <h3 className="relative z-10 mt-5 text-2xl font-display text-white tracking-wide">{title}</h3>
    <p className="relative z-10 mt-3 text-[var(--rf-muted)] leading-relaxed">{subtitle}</p>

    <div className="relative z-10 mt-6 pt-5 border-t border-cyan-900/45 flex items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-cyan-300/80">Ortalama süre</p>
        <p className="text-white font-semibold">{duration}</p>
      </div>
      <div className="space-y-1 text-right">
        <p className="text-xs uppercase tracking-[0.14em] font-pixel text-cyan-300/80">Mod</p>
        <p className="text-white font-semibold">{mode}</p>
      </div>
    </div>

    <div className="relative z-10 mt-5 text-sm font-semibold text-cyan-200 flex items-center gap-2 group-hover:text-white transition-colors">
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
            <span className="cd-kicker">HIZLI ARCADE RETRO OYUNLAR</span>
            <h2
              data-testid="games-main-heading"
              className="mt-4 text-3xl md:text-5xl font-display text-white max-w-2xl leading-tight"
            >
              Bekleme dakikalarını oyuna çeviren kısa tur kütüphanesi.
            </h2>
          </div>
          <div className="cd-panel px-5 py-4 max-w-sm border-cyan-400/25">
            <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Neden işe yarıyor?</p>
            <p className="mt-2 text-[var(--rf-muted)]">
              Turlar kısa, eşleşme hızlı; kullanıcı oyunda kalır ve puan döngüsü kesilmez.
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
              <p className="font-semibold text-white">Beklerken Oyna</p>
              <p className="text-sm text-[var(--rf-muted)]">Kafedeki bekleme süresini aktif oyuna dönüştür.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3 border-cyan-400/20">
            <Sparkles className="text-fuchsia-300" size={20} />
            <div>
              <p className="font-semibold text-white">Anlık Kazanç</p>
              <p className="text-sm text-[var(--rf-muted)]">Her tur puanı cüzdana işlenir, ödül hedefine yaklaştırır.</p>
            </div>
          </div>
          <div className="cd-panel p-4 flex items-center gap-3 border-cyan-400/20">
            <Gauge className="text-amber-300" size={20} />
            <div>
              <p className="font-semibold text-white">Kafe Bağı</p>
              <p className="text-sm text-[var(--rf-muted)]">Oyun ve ödül döngüsüyle tekrar gelme motivasyonu artar.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
