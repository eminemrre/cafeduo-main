import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

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
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Background - Clean solid with subtle gradient */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-slate-950 to-slate-950" />

      {/* Marquee Banner - Clean and minimal */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900/70 border-b border-slate-800/50 overflow-hidden py-2 backdrop-blur-sm">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="inline-block px-8 text-xs font-medium tracking-[0.15em] uppercase text-slate-400">
            ☕ Kafelerde Oyun Oyna • 🎮 3 Farklı Oyun • 🏆 Puan Kazan • 🎁 Ödüller Al • ♟️ Retro Satranç • 🎯 Tank Düellosu • 🧠 Bilgi Yarışması
          </span>
          <span className="inline-block px-8 text-xs font-medium tracking-[0.15em] uppercase text-slate-400">
            ☕ Kafelerde Oyun Oyna • 🎮 3 Farklı Oyun • 🏆 Puan Kazan • 🎁 Ödüller Al • ♟️ Retro Satranç • 🎯 Tank Düellosu • 🧠 Bilgi Yarışması
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left Panel - Clean hierarchy */}
          <div className="text-center lg:text-left animate-fade-in-up">
            <p className="text-xs sm:text-sm tracking-[0.15em] text-rose-500 uppercase font-semibold mb-6">
              Kafede Beklerken Oyna
            </p>

            <h1 lang="tr" className="hero-title-wrapper mb-6">
              <span className="hero-title block text-4xl sm:text-5xl lg:text-6xl leading-tight text-white font-bold">
                Kafenin
              </span>
              <span className="hero-title block text-4xl sm:text-5xl lg:text-6xl leading-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-rose-500 font-bold">
                Oyun Platformu
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
              Kafede beklerken arkadaşlarınla oyun oyna, puan kazan, ödüller al.
              Retro satranç, tank düellosu ve bilgi yarışması seni bekliyor.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {isLoggedIn ? (
                <button
                  onClick={handlePanelClick}
                  aria-label="Kontrol paneline git"
                  className="group px-8 py-4 bg-sky-500 text-white font-sans uppercase font-bold tracking-wide text-base hover:bg-sky-600 transition-all duration-200 flex items-center justify-center gap-3 rounded-lg shadow-lg hover:shadow-sky-500/20"
                >
                  Panele Geç <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <>
                  <button
                    onClick={onRegister}
                    aria-label="Kayıt ol ve oyuna başla"
                    className="group px-8 py-4 bg-rose-500 text-white font-sans uppercase font-bold tracking-wide text-base hover:bg-rose-600 transition-all duration-200 flex items-center justify-center gap-3 rounded-lg shadow-lg hover:shadow-rose-500/20"
                  >
                    <Sparkles size={18} /> Ücretsiz Kaydol
                  </button>

                  <button
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    aria-label="Oturum aç"
                    className="px-8 py-4 text-white font-sans uppercase font-bold tracking-wide text-base border-2 border-slate-700 hover:border-sky-500 hover:bg-slate-800/50 transition-all duration-200 flex items-center justify-center gap-3 rounded-lg"
                  >
                    Oturum Aç
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Panel - Simple stat cards */}
          <div className="flex justify-center lg:justify-end animate-fade-in-up-slow">
            <div className="glass rounded-2xl p-6 lg:p-8 max-w-sm w-full border border-slate-700/50 shadow-2xl bg-slate-900/60 backdrop-blur-md">
              <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
                <span className="font-display text-lg text-white uppercase tracking-wide">CafeDuo</span>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                  <div className="w-2.5 h-2.5 bg-sky-500/40 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-sky-500/40 rounded-full" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-sky-500/40 transition-colors duration-200">
                  <div className="w-10 h-10 bg-sky-500/15 text-sky-400 flex items-center justify-center rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <p className="font-sans font-semibold text-white text-sm">Anlık Eşleşme</p>
                    <p className="text-xs text-slate-400">Gerçek zamanlı rakip bulma</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-rose-500/40 transition-colors duration-200">
                  <div className="w-10 h-10 bg-rose-500/15 text-rose-400 flex items-center justify-center rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="font-sans font-semibold text-white text-sm">Hızlı Oyun</p>
                    <p className="text-xs text-slate-400">45-90 saniyelik turlar</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20">
                  <div className="flex items-center justify-between text-xs font-sans uppercase tracking-wide text-slate-400 mb-2">
                    <span>Bağlantı</span>
                    <span className="text-sky-400 font-semibold">Aktif</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full w-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-400 to-rose-500 rounded-full w-full animate-pulse-soft" />
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
