import React from 'react';
import { Timer, Swords, Brain, Crown, Sparkles, Gauge, ArrowUpRight } from 'lucide-react';

interface GameCardData {
  title: string;
  subtitle: string;
  duration: string;
  mode: string;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
  badge: string;
  cta: string;
  onClick?: () => void;
}

const games: GameCardData[] = [
  {
    title: 'Retro Satranç',
    subtitle: 'Gerçek zamanlı satrançta hamleni temiz oyna, süreyi doğru yönet.',
    duration: '3+2 / 5+0',
    mode: 'Strateji',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-400/10 border-amber-400/30',
    icon: <Crown size={18} />,
    badge: 'Strateji',
    cta: 'Tahtaya geç',
  },
  {
    title: 'Bilgi Sprinti',
    subtitle: 'Rastgele sorularda hız ve doğrulukla rakibini geride bırak.',
    duration: '45-60 sn',
    mode: 'Quiz modu',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10 border-emerald-400/30',
    icon: <Brain size={18} />,
    badge: 'Bilgi',
    cta: 'Sprinti aç',
  },
  {
    title: 'Tank Düellosu',
    subtitle: 'Açı ve güç ayarla, rakip tankı vur. İlk 3 isabet alan kazanır.',
    duration: '60-90 sn',
    mode: 'Savaş',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-400/10 border-red-400/30',
    icon: <Swords size={18} />,
    badge: 'Savaş',
    cta: 'Düelloya başla',
  },
];

const GameCard: React.FC<GameCardData> = ({ title, subtitle, duration, mode, accentColor, accentBg, icon, badge, cta, onClick }) => (
  <article
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    aria-label={`${title} - ${cta}`}
    className="group relative rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-black/20 hover:border-slate-600/60 cursor-pointer"
  >
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${accentColor} ${accentBg}`}>
      {icon}
      <span>{badge}</span>
    </div>

    <h3 className="mt-4 text-2xl font-display text-white tracking-wide">{title}</h3>
    <p className="mt-2 text-slate-400 leading-relaxed text-sm">{subtitle}</p>

    <div className="mt-5 pt-4 border-t border-slate-700/40 flex items-center justify-between text-sm">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">Süre</p>
        <p className="text-white font-semibold">{duration}</p>
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-wider text-slate-500">Mod</p>
        <p className="text-white font-semibold">{mode}</p>
      </div>
    </div>

    <div className="mt-4 text-sm font-semibold text-sky-400 flex items-center gap-1.5 group-hover:text-sky-300 transition-colors">
      <span>{cta}</span>
      <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
    </div>
  </article>
);

export const Games: React.FC<{ onPlayClick?: () => void }> = ({ onPlayClick }) => {
  return (
    <section id="games" className="cd-section overflow-hidden" aria-label="Oyunlar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="cd-kicker">Kısa Tur Oyunları</span>
          <h2
            data-testid="games-main-heading"
            className="mt-4 text-3xl md:text-5xl font-display text-white leading-tight"
          >
            Bekleme dakikalarını oyuna çeviren kısa tur kütüphanesi.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {games.map((game) => (
            <GameCard key={game.title} {...game} onClick={onPlayClick} />
          ))}
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 flex items-center gap-3 bg-slate-900/60 border border-slate-700/40">
            <Timer className="text-sky-400 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Beklerken Oyna</p>
              <p className="text-xs text-slate-400">Kafedeki bekleme süresini aktif oyuna dönüştür.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 flex items-center gap-3 bg-slate-900/60 border border-slate-700/40">
            <Sparkles className="text-rose-400 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Anlık Kazanç</p>
              <p className="text-xs text-slate-400">Her tur puanı cüzdana işlenir, ödül hedefine yaklaştırır.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 flex items-center gap-3 bg-slate-900/60 border border-slate-700/40">
            <Gauge className="text-amber-400 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Kafe Bağı</p>
              <p className="text-xs text-slate-400">Oyun ve ödül döngüsüyle tekrar gelme motivasyonu artar.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
