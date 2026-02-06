import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Coffee, ShieldCheck, Gamepad2, Zap } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { ABTest } from './ABTest';

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
    <section id="home" className="relative min-h-[calc(100vh-72px)] md:min-h-screen pt-24 md:pt-32 overflow-hidden">
      <motion.div
        className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
        animate={{ x: [0, 24, -12, 0], y: [0, -16, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-20 top-24 h-80 w-80 rounded-full bg-amber-400/14 blur-3xl"
        animate={{ x: [0, -30, 12, 0], y: [0, 12, -18, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 rf-grid opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="rf-kicker mb-5">RETRO-FÜTÜRİSTİK SOSYAL KAFE AĞI</span>

            <h1 className="font-display text-[2.25rem] sm:text-[2.8rem] md:text-[4.2rem] leading-[1.02] text-white tracking-tight">
              Kafenin ritmini
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-teal-300">
                mini oyunlarla
              </span>
              gerçek zamanlı yaşat.
            </h1>

            <p className="mt-5 text-lg sm:text-xl md:text-[1.6rem] text-slate-300 max-w-2xl leading-snug">
              CafeDuo; hızlı maç, canlı skor ve ödül döngüsünü tek akışta birleştirir.
              Oyuncu, masa ve kafe paneli aynı omurgada buluşur.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              {isLoggedIn ? (
                <RetroButton
                  onClick={handlePanelClick}
                  className="w-full sm:w-auto min-w-[220px] py-3.5 text-base"
                  variant="primary"
                >
                  PANELE GEÇ <ArrowRight className="ml-2" size={18} />
                </RetroButton>
              ) : (
                <>
                  <ABTest
                    testName="hero_cta_text"
                    variantA={
                      <RetroButton
                        onClick={onRegister}
                        className="w-full sm:w-auto min-w-[220px] py-3.5 text-base"
                        variant="primary"
                      >
                        HEMEN BAŞLA <ArrowRight className="ml-2" size={18} />
                      </RetroButton>
                    }
                    variantB={
                      <RetroButton
                        onClick={onRegister}
                        className="w-full sm:w-auto min-w-[220px] py-3.5 text-base"
                        variant="primary"
                      >
                        ÜCRETSİZ KAYDOL <Sparkles className="ml-2" size={18} />
                      </RetroButton>
                    }
                  />

                  <RetroButton
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    className="w-full sm:w-auto min-w-[220px] py-3.5 text-base"
                    variant="secondary"
                  >
                    GİRİŞ YAP
                  </RetroButton>
                </>
              )}
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              <div className="rf-panel p-4 animate-neon-pulse">
                <p className="font-pixel text-[10px] tracking-[0.18em] text-cyan-300 uppercase">Tur süresi</p>
                <p className="text-3xl font-display text-white mt-1">45 sn</p>
                <p className="text-sm text-slate-300 mt-1">Kısa ve tekrar eden maç döngüsü</p>
              </div>
              <div className="rf-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.18em] text-cyan-300 uppercase">Oyun modu</p>
                <p className="text-3xl font-display text-white mt-1">3+</p>
                <p className="text-sm text-slate-300 mt-1">Hızlı tüketilen özgün mini oyun</p>
              </div>
              <div className="rf-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.18em] text-cyan-300 uppercase">Ödül akışı</p>
                <p className="text-3xl font-display text-white mt-1">Anlık</p>
                <p className="text-sm text-slate-300 mt-1">Kupon doğrulama ile kapanış</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
          >
            <div className="rf-panel p-6 md:p-8 relative overflow-hidden">
              <div className="absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-70" />
              <div className="absolute right-6 top-6 h-20 w-20 rounded-full bg-cyan-400/20 blur-2xl animate-float-slow" />

              <h3 className="font-display text-3xl text-white mb-6 tracking-wide">Canlı Akış Paneli</h3>

              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-400/30 bg-[#0a1632]/76 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-400/20 text-cyan-200 flex items-center justify-center">
                      <Coffee size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Kafe girişi doğrulandı</p>
                      <p className="text-sm text-slate-300">Masa ve PIN doğrulaması 12 saniyede tamamlandı.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-orange-400/30 bg-[#25152b]/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-400/20 text-orange-200 flex items-center justify-center">
                      <Gamepad2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Refleks Avı başlatıldı</p>
                      <p className="text-sm text-slate-300">Lobiden eşleşme ve skor takibi gerçek zamanlı sürüyor.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#050a19] border border-cyan-400/20 p-4">
                  <div className="flex items-center justify-between text-xs font-pixel uppercase tracking-[0.16em] text-slate-400 mb-2">
                    <span>Sistem sağlığı</span>
                    <span className="text-cyan-300">Aktif</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-300 via-cyan-400 to-indigo-400"
                      initial={{ width: '0%' }}
                      animate={{ width: ['35%', '82%', '68%', '91%'] }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <ShieldCheck size={16} className="mx-auto text-cyan-300" />
                      <p className="text-[11px] text-slate-300 mt-1">Güvenlik</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <Zap size={16} className="mx-auto text-indigo-300" />
                      <p className="text-[11px] text-slate-300 mt-1">Hız</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <Sparkles size={16} className="mx-auto text-orange-300" />
                      <p className="text-[11px] text-slate-300 mt-1">Ödül</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
