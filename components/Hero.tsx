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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050a19] via-[#0a1628] to-[#0d0a1a]" />
      <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-neon-blue/5 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-24 pb-32">
        {/* Left column - Typography */}
        <div className="lg:col-span-7 flex flex-col justify-center animate-fade-in-up">
          <div className="inline-block bg-neon-pink/15 text-neon-pink text-xs uppercase tracking-[0.3em] font-bold px-4 py-1.5 rounded-full border border-neon-pink/30 mb-6 w-fit">
            KAFEDE BEKLERKEN OYNA
          </div>

          <div lang="tr" className="hero-title-wrapper flex flex-col tracking-tight">
            <span className="hero-title block text-[4.5rem] sm:text-[6rem] lg:text-[8rem] leading-[0.85] text-ink-50 font-black">
              KAFENİN
            </span>
            <span className="hero-title block text-[4.5rem] sm:text-[6rem] lg:text-[8rem] leading-[0.88] text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-pink font-black -mt-1 lg:-mt-2">
              OYUN
            </span>
            <span className="hero-title block text-[4.5rem] sm:text-[6.5rem] lg:text-[9rem] leading-[0.9] text-ink-50 font-black -mt-1 lg:-mt-3 ml-1 lg:ml-4">
              PLATFORMU
            </span>
          </div>

          <p className="mt-4 text-lg md:text-xl text-ink-200 font-sans max-w-xl leading-relaxed border-l-4 border-neon-blue pl-6 ml-1">
            Kafede beklerken seni mekandaki aktif oyuncularla <span className="text-neon-pink font-bold">45-60 saniyelik</span> rekabetçi mini oyunlarda eşleştiren sosyal oyun platformu.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-lg">
            {isLoggedIn ? (
              <button
                onClick={handlePanelClick}
                aria-label="Kontrol paneline git"
                className="group px-8 py-4 bg-neon-blue text-cyber-dark font-sans uppercase font-bold tracking-widest text-lg border-2 border-neon-blue hover:bg-transparent hover:text-neon-blue transition-all duration-200 flex items-center justify-center gap-3 rounded-lg"
              >
                Panele Geç <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <button
                  onClick={onRegister}
                  aria-label="Kayıt ol ve oyuna başla"
                  className="group px-8 py-4 bg-neon-pink text-cyber-dark font-sans uppercase font-bold tracking-widest text-lg border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-all duration-200 flex items-center justify-center gap-3 rounded-lg neon-glow-pink"
                >
                  <Sparkles size={20} /> OYUNA GİR
                </button>

                <button
                  onClick={onLogin}
                  data-testid="hero-login-button"
                  aria-label="Oturum aç"
                  className="px-8 py-4 text-ink-50 font-sans uppercase font-bold tracking-widest text-lg border-2 border-cyber-border hover:border-neon-blue hover:bg-neon-blue/10 transition-all duration-200 flex items-center gap-3 rounded-lg"
                >
                  OTURUM AÇ
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right column - Preview card */}
        <div className="lg:col-span-5 relative flex items-center justify-center animate-fade-in-up-slow">
          <div className="relative w-full max-w-md glass rounded-2xl p-8 border border-neon-blue/20">
            <div className="flex justify-between items-center mb-6 border-b border-cyber-border/50 pb-4">
              <span className="font-display text-lg text-ink-50 uppercase tracking-widest">CafeDuo</span>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-neon-pink rounded-full animate-pulse" />
                <div className="w-2.5 h-2.5 bg-neon-blue/40 rounded-full" />
                <div className="w-2.5 h-2.5 bg-neon-blue/40 rounded-full" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-cyber-bg/60 border border-cyber-border/30 hover:border-neon-blue/40 transition-colors">
                <div className="w-10 h-10 bg-neon-blue/15 text-neon-blue flex items-center justify-center rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <p className="font-sans font-bold text-ink-50 text-sm">Anlık Eşleşme</p>
                  <p className="text-xs text-ink-300">Gerçek zamanlı rakip bulma</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-cyber-bg/60 border border-cyber-border/30 hover:border-neon-pink/40 transition-colors">
                <div className="w-10 h-10 bg-neon-pink/15 text-neon-pink flex items-center justify-center rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="font-sans font-bold text-ink-50 text-sm">Hızlı Oyun</p>
                  <p className="text-xs text-ink-300">45-90 saniyelik turlar</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neon-blue/5 border border-neon-blue/20">
                <div className="flex items-center justify-between text-xs font-sans uppercase tracking-wider text-ink-200 mb-2">
                  <span>Bağlantı</span>
                  <span className="text-neon-blue font-bold">Aktif</span>
                </div>
                <div className="h-1 bg-cyber-dark rounded-full w-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-neon-blue to-neon-pink rounded-full w-full animate-pulse-soft" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
