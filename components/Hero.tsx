import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coffee, Sparkles, Timer, Trophy, Users, WalletCards } from 'lucide-react';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

const tableRows = [
  { label: 'Bilgi Sprinti', value: '02 oyuncu', tone: 'text-emerald-200' },
  { label: 'Retro Satranç', value: 'Masa 05', tone: 'text-sky-200' },
  { label: 'Tank Düellosu', value: '+120 CP', tone: 'text-amber-200' },
];

export const Hero: React.FC<HeroProps> = ({ onLogin, onRegister, isLoggedIn, userRole, isAdmin }) => {
  const navigate = useNavigate();

  const handlePanelClick = () => {
    if (isAdmin) {
      navigate('/admin');
    } else if (userRole === 'cafe_admin') {
      navigate('/cafe-admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <section
      id="home"
      aria-label="Ana bölüm"
      className="cd-hero-shell relative min-h-screen overflow-hidden"
    >
      <div className="cd-topline absolute left-0 right-0 top-0 z-[3] overflow-hidden py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 sm:px-6 lg:px-8">
          <span>Canlı masa oyunu</span>
          <span className="hidden sm:inline">Kısa tur deneyimi</span>
          <span className="hidden md:inline">Puan, cüzdan, ödül</span>
        </div>
      </div>

      <div className="relative z-[2] mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.86fr)] lg:gap-14">
          <div className="max-w-3xl text-center lg:text-left">
            <p className="cd-kicker justify-center lg:justify-start">
              CafeDuo oyun ve sadakat platformu
            </p>

            <h1 lang="tr" className="mt-5 font-display-tr text-[2.72rem] leading-[1.02] text-white sm:mt-6 sm:text-6xl lg:text-7xl">
              <span className="block">Kafenin</span>
              <span className="block text-slate-200">Oyun Platformu</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8 lg:mx-0">
              Kafede bekleme süresini oyuna çevir. CafeDuo aynı kafedeki kullanıcıları hızlı oyunlarda buluşturur,
              puan ve ödül akışını doğal şekilde görünür kılar.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row lg:justify-start">
              {isLoggedIn ? (
                <button
                  onClick={handlePanelClick}
                  aria-label="Kontrol paneline git"
                  className="cd-button-primary group inline-flex items-center justify-center gap-3 rounded-md px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-200"
                >
                  Panele Geç <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                </button>
              ) : (
                <>
                  <button
                    onClick={onRegister}
                    aria-label="Kayıt ol ve oyuna başla"
                    className="cd-button-primary group inline-flex items-center justify-center gap-3 rounded-md px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-200"
                  >
                    <Sparkles size={18} /> Ücretsiz Kaydol
                  </button>

                  <button
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    aria-label="Oturum aç"
                    className="cd-button-secondary inline-flex items-center justify-center gap-3 rounded-md px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-200"
                  >
                    Oturum Aç
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 text-left sm:mt-8 sm:max-w-xl lg:max-w-lg">
              <div className="cd-mini-stat">
                <Timer size={16} />
                <span>45 sn tur</span>
              </div>
              <div className="cd-mini-stat">
                <Users size={16} />
                <span>Anlık eşleşme</span>
              </div>
              <div className="cd-mini-stat">
                <Trophy size={16} />
                <span>Ödül akışı</span>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[450px] lg:mx-0 lg:justify-self-end">
            <div className="cd-product-panel rounded-md p-4 sm:p-5">
              <div className="cd-product-window rounded-md">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="cd-brand-mark flex h-10 w-10 items-center justify-center rounded-md">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">CafeDuo Live</p>
                      <p className="text-xs text-slate-400">Masa deneyimi aktif</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
                    Online
                  </span>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Aktif masa</p>
                      <p className="mt-2 font-display-tr text-4xl leading-none text-white">05</p>
                      <p className="mt-1 text-xs text-slate-400">2 oyuncu hazır</p>
                    </div>
                    <div className="flex w-24 flex-col justify-between rounded-md border border-white/10 bg-white/[0.04] p-3 text-right">
                      <WalletCards className="ml-auto text-sky-200" size={19} />
                      <div>
                        <p className="font-display-tr text-2xl text-white">840</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">CP</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {tableRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-md border border-white/10 bg-slate-950/35 px-3 py-2.5">
                        <span className="text-sm text-slate-300">{row.label}</span>
                        <span className={`text-xs font-bold uppercase tracking-[0.12em] ${row.tone}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-md border border-white/10 bg-[#0d151f] p-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      <span>Tur ilerlemesi</span>
                      <span className="text-slate-300">78%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full w-[78%] rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
