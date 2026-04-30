import React from 'react';
import { ArrowUpRight, Brain, Crown, Gauge, Sparkles, Swords, Timer } from 'lucide-react';

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
    subtitle: 'Hamleni temiz oyna, süreyi doğru yönet ve kısa maçtan puan çıkar.',
    duration: '3+2 / 5+0',
    mode: 'Strateji',
    accentColor: 'text-amber-200',
    accentBg: 'bg-amber-300/10 border-amber-200/25',
    icon: <Crown size={18} />,
    badge: 'Strateji',
    cta: 'Tahtaya geç',
  },
  {
    title: 'Bilgi Sprinti',
    subtitle: 'Rastgele sorularda hız ve doğrulukla rakibini geride bırak.',
    duration: '45-60 sn',
    mode: 'Quiz modu',
    accentColor: 'text-emerald-200',
    accentBg: 'bg-emerald-300/10 border-emerald-200/25',
    icon: <Brain size={18} />,
    badge: 'Bilgi',
    cta: 'Sprinti aç',
  },
  {
    title: 'Nişancı Düellosu',
    subtitle: 'Nişangahı merkezde tut, doğru anda ateş et ve isabet serisi yap.',
    duration: '60-90 sn',
    mode: 'Düello',
    accentColor: 'text-rose-200',
    accentBg: 'bg-rose-300/10 border-rose-200/25',
    icon: <Swords size={18} />,
    badge: 'Aksiyon',
    cta: 'Düelloya başla',
  },
];

const GameCard: React.FC<GameCardData> = ({ title, subtitle, duration, mode, accentColor, accentBg, icon, badge, cta, onClick }) => (
  <article
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (event) => event.key === 'Enter' && onClick() : undefined}
    aria-label={`${title} - ${cta}`}
    className="cd-card group relative cursor-pointer rounded-md p-6 transition-colors duration-200"
  >
    <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] ${accentColor} ${accentBg}`}>
      {icon}
      <span>{badge}</span>
    </div>

    <h3 className="mt-5 font-display-tr text-2xl tracking-wide text-white">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>

    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Süre</p>
        <p className="font-semibold text-white">{duration}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Mod</p>
        <p className="font-semibold text-white">{mode}</p>
      </div>
    </div>

    <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-slate-200 transition-colors group-hover:text-white">
      <span>{cta}</span>
      <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
  </article>
);

export const Games: React.FC<{ onPlayClick?: () => void }> = ({ onPlayClick }) => {
  return (
    <section id="games" className="cd-section overflow-hidden" aria-label="Oyunlar">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-11 max-w-3xl text-center">
          <span className="cd-kicker justify-center">Kısa tur oyunları</span>
          <h2
            data-testid="games-main-heading"
            className="mt-4 font-display-tr text-3xl leading-tight text-white md:text-5xl"
          >
            Bekleme dakikalarını oyuna çeviren kısa tur kütüphanesi.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">
            Her oyun hızlı başlar, kısa sürer ve puan ekonomisine bağlanır.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.title} {...game} onClick={onPlayClick} />
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="cd-card flex items-center gap-3 rounded-md p-4">
            <Timer className="shrink-0 text-sky-200" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">Beklerken Oyna</p>
              <p className="text-xs leading-5 text-slate-400">Kafedeki boş zamanı aktif oyuna dönüştür.</p>
            </div>
          </div>
          <div className="cd-card flex items-center gap-3 rounded-md p-4">
            <Sparkles className="shrink-0 text-emerald-200" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">Anlık Kazanç</p>
              <p className="text-xs leading-5 text-slate-400">Her tur sonucu cüzdana net şekilde işlenir.</p>
            </div>
          </div>
          <div className="cd-card flex items-center gap-3 rounded-md p-4">
            <Gauge className="shrink-0 text-amber-200" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">Kafe Bağı</p>
              <p className="text-xs leading-5 text-slate-400">Sadakat döngüsü oyunla görünür hale gelir.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
