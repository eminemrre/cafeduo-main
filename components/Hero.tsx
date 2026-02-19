import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useScroll, useReducedMotion } from 'framer-motion';
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointerPxX = useMotionValue(-120);
  const pointerPxY = useMotionValue(-120);
  const [reticleVisible, setReticleVisible] = useState(false);
  const smoothX = useSpring(pointerX, { stiffness: 110, damping: 18 });
  const smoothY = useSpring(pointerY, { stiffness: 110, damping: 18 });
  const panelX = useTransform(smoothX, [-0.5, 0.5], [-20, 20]);
  const panelY = useTransform(smoothY, [-0.5, 0.5], [-14, 14]);
  const glowX = useTransform(smoothX, [-0.5, 0.5], ['20%', '80%']);
  const glowY = useTransform(smoothY, [-0.5, 0.5], ['26%', '72%']);
  const layerDriftX = useTransform(smoothX, [-0.5, 0.5], [-18, 18]);
  const layerDriftY = useTransform(smoothY, [-0.5, 0.5], [-12, 12]);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const starsY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const farRidgeY = useTransform(scrollYProgress, [0, 1], [0, -42]);
  const nearRidgeY = useTransform(scrollYProgress, [0, 1], [0, -18]);

  const handlePanelClick = () => {
    if (isAdmin) {
      navigate('/admin');
    } else if (userRole === 'cafe_admin') {
      navigate('/cafe-admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handlePointerMove = (event: React.MouseEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(x);
    pointerY.set(y);
    pointerPxX.set(event.clientX - rect.left);
    pointerPxY.set(event.clientY - rect.top);
    setReticleVisible(true);
  };

  return (
    <section
      ref={sectionRef}
      id="home"
      className="relative min-h-[calc(100vh-64px)] md:min-h-screen pt-[calc(5rem+env(safe-area-inset-top))] md:pt-32 overflow-hidden"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
        pointerPxX.set(-120);
        pointerPxY.set(-120);
        setReticleVisible(false);
      }}
    >
      <motion.div
        className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none"
        animate={reduceMotion ? undefined : { x: [0, 24, -12, 0], y: [0, -16, 10, 0] }}
        transition={reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-20 top-24 h-80 w-80 rounded-full bg-amber-400/22 blur-3xl pointer-events-none"
        animate={reduceMotion ? undefined : { x: [0, -30, 12, 0], y: [0, 12, -18, 0] }}
        transition={reduceMotion ? undefined : { duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="absolute inset-0 rf-grid opacity-20 pointer-events-none" style={{ y: starsY }} />
      {/* Synthwave animated grid overlay */}
      <div className="absolute left-0 right-0 top-0 bottom-[-100px] rf-grid opacity-25 pointer-events-none animate-grid-flow" style={{ perspective: '800px', transform: 'rotateX(45deg) scale(2)' }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(8,197,255,0.2),transparent_35%),radial-gradient(circle_at_82%_14%,rgba(242,165,90,0.2),transparent_42%)] animate-aurora-pan pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(3,14,32,0.75)_0%,rgba(3,14,32,0.2)_45%,rgba(36,86,142,0.22)_100%)] pointer-events-none" />
      <motion.div
        className="absolute h-40 w-40 rounded-full pointer-events-none bg-cyan-400/20 blur-3xl"
        style={{ left: glowX, top: glowY }}
      />
      <motion.div className="absolute inset-x-0 bottom-0 h-[32vh] opacity-70 pointer-events-none" style={{ y: farRidgeY, x: layerDriftX }}>
        <div
          className="absolute inset-0 bg-[#0a1730]/70"
          style={{ clipPath: 'polygon(0 74%, 12% 62%, 22% 70%, 34% 58%, 49% 74%, 62% 60%, 76% 68%, 88% 54%, 100% 72%, 100% 100%, 0 100%)' }}
        />
      </motion.div>
      <motion.div className="absolute inset-x-0 bottom-0 h-[28vh] opacity-90 pointer-events-none" style={{ y: nearRidgeY, x: layerDriftY }}>
        <div
          className="absolute inset-0 bg-[#050d1f]"
          style={{ clipPath: 'polygon(0 84%, 8% 72%, 17% 80%, 28% 64%, 41% 84%, 52% 70%, 63% 82%, 74% 68%, 86% 78%, 94% 66%, 100% 74%, 100% 100%, 0 100%)' }}
        />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 z-20 hidden lg:flex items-center justify-center h-16 w-16 rounded-full border border-cyan-300/45 bg-cyan-400/10 backdrop-blur-[2px] -translate-x-1/2 -translate-y-1/2"
        style={{ x: pointerPxX, y: pointerPxY, opacity: !reduceMotion && reticleVisible ? 1 : 0 }}
      >
        <motion.div
          className="absolute inset-2 rounded-full border border-cyan-300/55"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-8 h-[1px] bg-cyan-200/70"
          animate={reduceMotion ? undefined : { opacity: [0.4, 0.8, 0.4] }}
          transition={reduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute h-8 w-[1px] bg-cyan-200/70"
          animate={reduceMotion ? undefined : { opacity: [0.4, 0.8, 0.4] }}
          transition={reduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        />
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(10,215,255,0.9)]" />
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <motion.div
            className="lg:col-span-7 min-w-0"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="rf-kicker mb-5">KAFEDE BEKLERKEN OYUNA BAĞLAN</span>

            <h1
              data-testid="hero-main-heading"
              className="font-display text-[2rem] max-[360px]:text-[1.75rem] sm:text-[2.95rem] md:text-[4.45rem] leading-[1.02] text-white tracking-tight drop-shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
            >
              Bekleme süresini
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-teal-300">
                eşleşmeli mini oyunlarla
              </span>
              ödüllü ana dönüştür.
            </h1>

            <p className="mt-5 text-base sm:text-xl md:text-[1.45rem] text-slate-300 max-w-2xl leading-snug">
              CafeDuo, kafede arkadaşını beklerken seni o an aktif oyuncularla eşleştirir.
              Kısa maçlarda puan toplar, ödüle yaklaşır ve zamanı keyfe çevirirsin.
            </p>

            <div className="mt-5 grid grid-cols-1 min-[520px]:grid-cols-3 gap-2.5 max-w-2xl">
              <div className="rounded-xl border border-cyan-400/32 bg-[#08193a]/70 px-3 py-2">
                <p className="font-pixel text-[10px] tracking-[0.14em] uppercase text-cyan-300">Hızlı Tur</p>
                <p className="text-sm text-slate-100">45 sn ortalama maç</p>
              </div>
              <div className="rounded-xl border border-cyan-400/32 bg-[#08193a]/70 px-3 py-2">
                <p className="font-pixel text-[10px] tracking-[0.14em] uppercase text-cyan-300">Eşleşme</p>
                <p className="text-sm text-slate-100">Kafedeki oyuncuyla anlık eşleş</p>
              </div>
              <div className="rounded-xl border border-cyan-400/32 bg-[#08193a]/70 px-3 py-2">
                <p className="font-pixel text-[10px] tracking-[0.14em] uppercase text-cyan-300">Güvenli Giriş</p>
                <p className="text-sm text-slate-100">Tek adımda güvenli doğrulama</p>
              </div>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              {isLoggedIn ? (
                <RetroButton
                  onClick={handlePanelClick}
                  className="w-full sm:w-auto min-w-0 sm:min-w-[220px] py-3.5 text-base border-cyan-400 shadow-[0_0_15px_rgba(10,215,255,0.3)] hover:shadow-[0_0_30px_rgba(10,215,255,0.6)] transition-all z-10"
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
                        className="w-full sm:w-auto min-w-0 sm:min-w-[220px] py-3.5 text-base border-cyan-400 shadow-[0_0_15px_rgba(10,215,255,0.3)] hover:shadow-[0_0_30px_rgba(10,215,255,0.6)] transition-all z-10"
                        variant="primary"
                      >
                        KAYDOL VE EŞLEŞ <ArrowRight className="ml-2" size={18} />
                      </RetroButton>
                    }
                    variantB={
                      <RetroButton
                        onClick={onRegister}
                        className="w-full sm:w-auto min-w-0 sm:min-w-[220px] py-3.5 text-base border-cyan-400 shadow-[0_0_15px_rgba(10,215,255,0.3)] hover:shadow-[0_0_30px_rgba(10,215,255,0.6)] transition-all z-10"
                        variant="primary"
                      >
                        KAYDOL VE EŞLEŞ <Sparkles className="ml-2" size={18} />
                      </RetroButton>
                    }
                  />

                  <RetroButton
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    className="w-full sm:w-auto min-w-0 sm:min-w-[220px] py-3.5 text-base border-slate-700 hover:border-cyan-800/60 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                    variant="secondary"
                  >
                    OTURUM AÇ
                  </RetroButton>
                </>
              )}
            </div>

            <div className="mt-7 grid grid-cols-1 min-[520px]:grid-cols-3 gap-3 max-w-2xl">
              <div className="rf-panel p-4 rf-horizon">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-cyan-300 uppercase">Tur Süresi</p>
                <p className="text-3xl font-display text-white mt-1">45 sn</p>
                <p className="text-sm text-slate-300 mt-1">Beklerken tek turda tamamlanır.</p>
              </div>
              <div className="rf-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-cyan-300 uppercase">Eşleşme Modu</p>
                <p className="text-3xl font-display text-white mt-1">Canlı</p>
                <p className="text-sm text-slate-300 mt-1">Kafedeki aktif oyuncularla anında eşleş.</p>
              </div>
              <div className="rf-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-cyan-300 uppercase">Ödül Akışı</p>
                <p className="text-3xl font-display text-white mt-1">Anlık</p>
                <p className="text-sm text-slate-300 mt-1">Her maç puanı hesabına direkt yansır.</p>
              </div>
            </div>

            <div className="mt-6 max-w-full overflow-hidden rounded-full border border-cyan-400/30 bg-[#06142b]/84 hidden sm:block">
              <motion.div
                className="flex items-center gap-8 sm:whitespace-nowrap px-5 py-2 text-[11px] uppercase tracking-[0.2em] font-pixel text-cyan-200/85"
                animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
                transition={reduceMotion ? undefined : { duration: 15, repeat: Infinity, ease: 'linear' }}
              >
                <span>Beklerken eşleş</span>
                <span>Kısa tur, hızlı sonuç</span>
                <span>Puanla ödüle yaklaş</span>
                <span>Beklerken eşleş</span>
                <span>Kısa tur, hızlı sonuç</span>
                <span>Puanla ödüle yaklaş</span>
              </motion.div>
            </div>

            <div className="mt-6 sm:hidden grid grid-cols-1 gap-2 max-w-2xl">
              <div className="rounded-full border border-cyan-400/25 bg-[#06142b]/78 px-4 py-2 text-[11px] uppercase tracking-[0.14em] font-pixel text-cyan-200/85">
                Beklerken eşleş
              </div>
              <div className="rounded-full border border-cyan-400/25 bg-[#06142b]/78 px-4 py-2 text-[11px] uppercase tracking-[0.14em] font-pixel text-cyan-200/85">
                Kısa tur, hızlı sonuç
              </div>
              <div className="rounded-full border border-cyan-400/25 bg-[#06142b]/78 px-4 py-2 text-[11px] uppercase tracking-[0.14em] font-pixel text-cyan-200/85">
                Puanla ödüle yaklaş
              </div>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-5 min-w-0"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
            style={{ x: panelX, y: panelY }}
          >
            <div className="rf-panel rf-elevated p-6 md:p-8 relative overflow-hidden">
              <div className="absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-70" />
              <div className="absolute right-6 top-6 h-20 w-20 rounded-full bg-cyan-400/20 blur-2xl animate-float-slow" />
              <div className="absolute -left-14 bottom-8 h-36 w-36 rounded-full bg-amber-300/15 blur-2xl" />

              <h3 className="font-display text-3xl text-white mb-6 tracking-wide">Canlı Bekleme Akışı</h3>

              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-400/30 bg-[#0a1632]/76 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-400/20 text-cyan-200 flex items-center justify-center">
                      <Coffee size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Güvenli giriş tamamlandı</p>
                      <p className="text-sm text-slate-300">Masa doğrulaması bitti, eşleşme için hazırsın.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-orange-400/30 bg-[#25152b]/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-400/20 text-orange-200 flex items-center justify-center">
                      <Gamepad2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Eşleşme bulundu</p>
                      <p className="text-sm text-slate-300">Aynı kafedeki oyuncuyla maç başladı.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#050a19] border border-cyan-400/20 p-4">
                  <div className="flex items-center justify-between text-xs font-pixel uppercase tracking-[0.16em] text-slate-400 mb-2">
                    <span>Sistem durumu</span>
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
                      <p className="text-[11px] text-slate-300 mt-1">Eşleşme</p>
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
