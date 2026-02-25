import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Coffee, Gamepad2 } from 'lucide-react';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

export const Hero: React.FC<HeroProps> = ({ onLogin, onRegister, isLoggedIn, userRole, isAdmin }) => {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

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
      ref={sectionRef}
      id="home"
      className="relative min-h-screen bg-cyber-bg flex items-center overflow-hidden"
    >
      {/* Brutalist Background Elements */}
      <div className="absolute top-0 right-0 w-[50vw] h-full bg-neon-blue/5 skew-x-12 origin-top-right transform translate-x-32" />
      <div className="absolute bottom-0 left-0 w-full h-[30vh] bg-cyber-dark clip-path-slant-up mix-blend-multiply" />

      {/* Glitch Decorative Texts */}
      <div className="absolute top-20 -left-10 opacity-10 pointer-events-none select-none rotate-90 origin-left">
        <span className="font-display text-[15rem] leading-none text-cyber-border whitespace-nowrap">CAFEDUO MOTORU</span>
      </div>

      <div className="relative z-10 w-full px-6 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center pt-24 pb-32">
      {/* LEFT COLUMN: Maximalist Typography */}
        <motion.div
          className="lg:col-span-7 flex flex-col justify-center translate-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="overflow-hidden mb-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
              className="inline-block bg-neon-pink text-cyber-dark font-sans text-xs uppercase tracking-[0.3em] font-bold px-4 py-1"
            >
              KAFEDE BEKLERKEN OYNA
            </motion.div>
          </div>

          <div lang="tr" className="hero-title-wrapper flex flex-col uppercase tracking-tight mix-blend-screen">
            <div className="overflow-hidden relative">
              <motion.span
                className="hero-title block text-[5rem] sm:text-[7rem] lg:text-[9rem] leading-[0.85] text-ink-50 font-black"
                initial={{ y: "100%", skewY: 10 }}
                animate={reduceMotion ? { y: 0, skewY: 0 } : { y: 0, skewY: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
              >
                KAFENİN
              </motion.span>
            </div>
            <div className="overflow-visible relative -translate-y-2 lg:-translate-y-4">
              <motion.span
                className="hero-title block text-[5rem] sm:text-[7rem] lg:text-[9rem] leading-[0.88] text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-pink font-black"
                initial={{ y: "100%", skewY: -10 }}
                animate={reduceMotion ? { y: 0, skewY: 0 } : { y: 0, skewY: 0 }}
                transition={{ delay: 0.35, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
              >
                OYUN
              </motion.span>
            </div>
            <div className="overflow-visible relative -translate-y-4 lg:-translate-y-8 ml-2 lg:ml-6">
              <motion.span
                className="hero-title block text-[5rem] sm:text-[7.5rem] lg:text-[10rem] leading-[0.9] text-ink-50 font-black"
                initial={{ y: "100%", skewY: 5 }}
                animate={reduceMotion ? { y: 0, skewY: 0 } : { y: 0, skewY: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
              >
                PLATFORMU
              </motion.span>
              <div className="absolute right-0 bottom-12 text-sm font-sans tracking-[0.25em] text-neon-blue rotate-90 origin-bottom-right opacity-50 hidden sm:block">
                // KAFENİN OYUN PLATFORMU
              </div>
            </div>
          </div>

          <motion.p
            className="mt-2 text-lg md:text-2xl text-ink-200 font-sans max-w-xl leading-relaxed border-l-4 border-neon-blue pl-6 ml-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            Kafede beklerken seni mekandaki aktif oyuncularla <span className="text-neon-pink font-bold">45-60 saniyelik</span> rekabetçi mini oyunlarda eşleştiren sosyal oyun platformu.
          </motion.p>

          <motion.div
            className="mt-12 flex flex-col sm:flex-row gap-6 w-full max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            {isLoggedIn ? (
              <button
                onClick={handlePanelClick}
                aria-label="Kontrol paneline git"
                className="group relative px-8 py-5 bg-neon-blue text-cyber-dark font-sans uppercase font-bold tracking-widest text-lg md:text-xl border-2 border-neon-blue hover:bg-transparent hover:text-neon-blue transition-colors flex items-center justify-center gap-4 shadow-[#00f3ff_4px_4px_0_0] transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                Panele Geç <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <>
                <button
                  onClick={onRegister}
                  aria-label="Kayıt ol ve oyuna başla"
                  className="group relative px-8 py-5 bg-neon-pink text-cyber-dark font-sans uppercase font-bold tracking-widest text-lg md:text-xl border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-colors flex items-center justify-center gap-4 shadow-[#ff00ea_4px_4px_0_0] active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <Sparkles size={20} /> OYUNA GİR
                </button>

                <button
                  onClick={onLogin}
                  data-testid="hero-login-button"
                  aria-label="Oturum aç"
                  className="px-8 py-5 text-ink-50 font-sans uppercase font-bold tracking-widest text-lg border-2 border-cyber-border hover:border-neon-blue hover:bg-neon-blue/10 transition-colors flex items-center gap-4"
                >
                  OTURUM AÇ
                </button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* RIGHT COLUMN: Asymmetric Dashboard Preview / Brutalist Card */}
        <motion.div
          className="lg:col-span-5 relative h-full flex items-center justify-center"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          {/* Decorative wireframe behind card */}
          <div className="absolute inset-0 max-w-[500px] border border-neon-blue/20 rotate-6 translate-x-4 translate-y-4 pointer-events-none" />
          <div className="absolute inset-0 max-w-[500px] border border-neon-pink/20 -rotate-3 -translate-x-2 -translate-y-2 pointer-events-none" />

          <div className="relative w-full max-w-[500px] bg-cyber-dark/80 backdrop-blur-2xl border-t border-l border-neon-blue shadow-[16px_16px_0px_rgba(0,243,255,0.15)] p-8 md:p-10">
            {/* Top Bar Pattern */}
            <div className="flex justify-between items-center mb-8 border-b border-cyber-border pb-4">
              <span className="font-display text-2xl text-ink-50 uppercase tracking-widest">SİSTEM TR-X</span>
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-neon-pink animate-pulse" />
                <div className="w-3 h-3 border border-neon-blue" />
                <div className="w-3 h-3 border border-neon-blue" />
              </div>
            </div>

            <div className="space-y-6 form-glitch">
              <div className="group relative border border-cyber-border bg-cyber-bg p-5 transition-colors hover:border-neon-blue hover:-translate-y-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-neon-blue/20 text-neon-blue flex items-center justify-center">
                    <Coffee size={24} />
                  </div>
                  <div>
                    <p className="font-sans font-bold text-ink-50 uppercase tracking-wide">Güvenli Bağlantı</p>
                    <p className="text-sm font-sans text-ink-300">Terminal A - Doğrulandı</p>
                  </div>
                </div>
              </div>

              <div className="group relative border border-cyber-border bg-cyber-bg p-5 transition-colors hover:border-neon-pink hover:-translate-y-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-neon-pink/20 text-neon-pink flex items-center justify-center">
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <p className="font-sans font-bold text-ink-50 uppercase tracking-wide">Eşleşme Motoru</p>
                    <p className="text-sm font-sans text-ink-300">Açık - Lobi Aranıyor</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border-l-4 border-neon-blue bg-neon-blue/5">
                <div className="flex items-center justify-between text-xs font-sans uppercase tracking-[0.2em] text-ink-200 mb-3">
                  <span>Yükleme</span>
                  <span className="text-neon-blue font-bold">100%</span>
                </div>
                <div className="h-1 bg-cyber-dark w-full">
                  <motion.div
                    className="h-full bg-neon-blue"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, delay: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="text-center font-sans">
                    <p className="text-[10px] text-ink-400 uppercase tracking-widest">Hız</p>
                    <p className="text-sm font-bold text-neon-blue">042ms</p>
                  </div>
                  <div className="text-center font-sans border-l border-cyber-border">
                    <p className="text-[10px] text-ink-400 uppercase tracking-widest">Tip</p>
                    <p className="text-sm font-bold text-neon-pink">V-09</p>
                  </div>
                  <div className="text-center font-sans border-l border-cyber-border">
                    <p className="text-[10px] text-ink-400 uppercase tracking-widest">Ağ</p>
                    <p className="text-sm font-bold text-ink-50">CANLI</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Absolute decor inside card */}
            <div className="absolute -bottom-4 -right-4 text-[10rem] font-display text-cyber-border opacity-20 pointer-events-none leading-none select-none">
              #1
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
