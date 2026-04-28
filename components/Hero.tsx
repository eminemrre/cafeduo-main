import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coffee, Sparkles, Timer, Trophy, Users } from 'lucide-react';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

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
      className="cd-hero-shell relative min-h-screen flex items-center overflow-hidden"
    >
      <div className="cd-topline absolute top-0 left-0 right-0 z-[2] overflow-hidden py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:px-6 lg:px-8">
          <span>Kafede beklerken oyna</span>
          <span className="hidden sm:inline">3 oyun modu</span>
          <span className="hidden md:inline">Puan kazan, ödüle yaklaş</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left animate-fade-in-up">
            <p className="cd-kicker justify-center lg:justify-start mb-6">
              Kafede Beklerken Oyna
            </p>

            <h1 lang="tr" className="mb-6 font-display-tr text-[3.15rem] leading-[0.98] tracking-[-0.01em] text-white sm:text-6xl lg:text-7xl">
              <span className="block">Kafenin</span>
              <span className="block text-slate-300">Oyun Platformu</span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              Kafede beklerken arkadaşlarınla oyun oyna, puan kazan, ödüller al.
              Retro satranç, tank düellosu ve bilgi yarışması seni bekliyor.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {isLoggedIn ? (
                <button
                  onClick={handlePanelClick}
                  aria-label="Kontrol paneline git"
                  className="cd-button-primary group px-8 py-4 font-sans uppercase font-bold tracking-wide text-base transition-all duration-200 flex items-center justify-center gap-3 rounded-md"
                >
                  Panele Geç <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <>
                  <button
                    onClick={onRegister}
                    aria-label="Kayıt ol ve oyuna başla"
                    className="cd-button-primary group px-8 py-4 font-sans uppercase font-bold tracking-wide text-base transition-all duration-200 flex items-center justify-center gap-3 rounded-md"
                  >
                    <Sparkles size={18} /> Ücretsiz Kaydol
                  </button>

                  <button
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    aria-label="Oturum aç"
                    className="cd-button-secondary px-8 py-4 font-sans uppercase font-bold tracking-wide text-base transition-all duration-200 flex items-center justify-center gap-3 rounded-md"
                  >
                    Oturum Aç
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end animate-fade-in-up-slow">
            <div className="cd-product-panel w-full max-w-[440px] rounded-md p-5 lg:p-6">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
                <div>
                  <span className="font-display-tr text-xl text-white tracking-wide">CafeDuo</span>
                  <p className="mt-1 text-xs text-slate-400">Canlı masa deneyimi</p>
                </div>
                <div className="cd-brand-mark flex h-10 w-10 items-center justify-center rounded-md">
                  <Coffee size={20} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="cd-product-panel-inner rounded-md p-4">
                  <Users className="text-sky-300" size={20} />
                  <p className="mt-4 text-2xl font-display-tr text-white">Anlık</p>
                  <p className="text-xs text-slate-400">Eşleşme</p>
                </div>
                <div className="cd-product-panel-inner rounded-md p-4">
                  <Timer className="text-emerald-300" size={20} />
                  <p className="mt-4 text-2xl font-display-tr text-white">45 sn</p>
                  <p className="text-xs text-slate-400">Kısa tur</p>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div className="cd-product-panel-inner flex items-center gap-4 rounded-md p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-600/50 bg-slate-950/60 text-sky-300">
                    <Trophy size={19} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Puan ve ödül akışı</p>
                    <p className="text-xs text-slate-400">Oyun sonucu cüzdana işlenir</p>
                  </div>
                </div>

                <div className="rounded-md border border-slate-700/40 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between text-xs font-sans uppercase tracking-wide text-slate-400 mb-3">
                    <span>Bağlantı</span>
                    <span className="text-emerald-300 font-semibold">Aktif</span>
                  </div>
                  <div className="h-1 bg-slate-800 w-full overflow-hidden rounded-full">
                    <div className="h-full bg-slate-200 w-full" />
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
