import React from 'react';
import { Timer, Swords, Brain, Crown, Sparkles, Gauge, ArrowUpRight } from 'lucide-react';

interface GameCardData {
  title: string;
  subtitle: string;
  duration: string;
  mode: string;
  accentFrom: string;
  accentTo: string;
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
    accentFrom: 'from-amber-400',
    accentTo: 'to-orange-500',
    icon: <Crown size={22} />,
    badge: 'Strateji',
    cta: 'Tahtaya geç',
  },
  {
    title: 'Bilgi Sprinti',
    subtitle: 'Rastgele sorularda hız ve doğrulukla rakibini geride bırak.',
    duration: '45-60 sn',
    mode: 'Quiz modu',
    accentFrom: 'from-emerald-400',
    accentTo: 'to-teal-500',
    icon: <Brain size={22} />,
    badge: 'Bilgi',
    cta: 'Sprinti aç',
  },
  {
    title: 'Tank Düellosu',
    subtitle: 'Açı ve güç ayarla, rakip tankı vur. İlk 3 isabet alan kazanır.',
    duration: '60-90 sn',
    mode: 'Savaş',
    accentFrom: 'from-red-400',
    accentTo: 'to-orange-500',
    icon: <Swords size={22} />,
    badge: 'Savaş',
    cta: 'Düelloya başla',
  },
];

const GameCard: React.FC<GameCardData> = ({ title, subtitle, duration, mode, accentFrom, accentTo, icon, badge, cta, onClick }) => (
  <article
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    aria-label={`${title} - ${cta}`}
    className="group relative rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#0a1228]/95 to-[#0d0a1a]/90 p-6 transition-all duration-300 hover:-translate-y-3 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(34,211,238,0.2)] hover:border-cyan-300/50 hover:scale-[1.02] cursor-pointer"
  >
    <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${accentFrom} ${accentTo} text-white px-3 py-1.5 text-xs font-bold tracking-wider uppercase`}>
      {icon}
      <span>{badge}</span>
    </div>

    <h3 className="mt-4 text-2xl font-display text-white tracking-wide">{title}</h3>
    <p className="mt-2 text-ink-300 leading-relaxed text-sm">{subtitle}</p>

    <div className="mt-5 pt-4 border-t border-cyan-900/40 flex items-center justify-between text-sm">
      <div>
        <p className="text-xs uppercase tracking-wider text-cyan-300/70">Süre</p>
        <p className="text-white font-semibold">{duration}</p>
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-wider text-cyan-300/70">Mod</p>
        <p className="text-white font-semibold">{mode}</p>
      </div>
    </div>

    <div className="mt-4 text-sm font-semibold text-cyan-200 flex items-center gap-1.5 group-hover:text-white transition-colors">
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
          <span className="cd-kicker">HIZLI ARCADE RETRO OYUNLAR</span>
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
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <Timer className="text-cyan-300 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Beklerken Oyna</p>
              <p className="text-xs text-ink-300">Kafedeki bekleme süresini aktif oyuna dönüştür.</p>
            </div>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <Sparkles className="text-fuchsia-300 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Anlık Kazanç</p>
              <p className="text-xs text-ink-300">Her tur puanı cüzdana işlenir, ödül hedefine yaklaştırır.</p>
            </div>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <Gauge className="text-amber-300 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-white text-sm">Kafe Bağı</p>
              <p className="text-xs text-ink-300">Oyun ve ödül döngüsüyle tekrar gelme motivasyonu artar.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
