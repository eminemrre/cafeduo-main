import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Coffee, LogOut, ChevronRight, Sparkles, ShoppingCart, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { BUILD_META } from '../lib/buildMeta';
import type { User } from '../types';

interface NavbarProps {
  isLoggedIn?: boolean;
  user?: User | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn = false, user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const scrollToSection = (id: string) => {
    setIsOpen(false);
    if (isLoggedIn) return;

    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] md:w-auto transition-transform duration-300">
        <div className="bg-cyber-dark/80 backdrop-blur-xl border border-neon-blue/40 shadow-[8px_8px_0px_rgba(255,0,234,0.3)] md:px-6 px-4 py-3 flex items-center justify-between gap-6">

          <motion.div
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
          >
            <div className="w-10 h-10 bg-neon-pink text-cyber-dark flex items-center justify-center font-bold">
              <Coffee size={22} />
            </div>
            <div className="leading-none">
              <span className="font-display text-2xl text-ink-50 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]">CafeDuo</span>
            </div>
          </motion.div>

          <div className="hidden md:flex items-center gap-2">
            {!isLoggedIn ? (
              NAV_ITEMS.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => scrollToSection(item.id)}
                  className="px-5 py-2 text-sm font-sans tracking-widest text-ink-200 hover:text-neon-blue hover:bg-cyber-card transition-all uppercase"
                >
                  {item.label}
                </motion.button>
              ))
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-l-4 border-neon-green bg-cyber-card px-3 py-1.5">
                  <Sparkles size={14} className="text-neon-green" />
                  <span className="font-sans text-xs text-neon-green uppercase font-bold tracking-widest">Canlı</span>
                </div>
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#050a19] border border-neon-blue/30 skew-x-[-5deg]">
                    <Wallet size={14} className="text-pink-500 skew-x-[5deg]" />
                    <span className="font-display text-lg text-neon-blue skew-x-[5deg]">{user.points} <span className="text-[10px] text-pink-500">CP</span></span>
                  </div>
                )}
                <motion.button
                  onClick={() => navigate('/store')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-neon-blue border border-neon-blue hover:bg-neon-blue hover:text-cyber-dark transition-colors uppercase font-bold"
                  whileTap={{ scale: 0.95 }}
                >
                  <ShoppingCart size={16} />
                  <span className="hidden lg:inline">MAĞAZA</span>
                </motion.button>
                <motion.button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-neon-pink border border-neon-pink hover:bg-neon-pink hover:text-cyber-dark transition-colors uppercase font-bold"
                  whileTap={{ scale: 0.95 }}
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">ÇIKIŞ</span>
                </motion.button>
              </div>
            )}
            <span
              className="text-[10px] text-neon-blue/60 font-sans tracking-widest uppercase ml-4 hidden lg:block"
              title={BUILD_META.buildTime !== 'unknown' ? `Build: ${BUILD_META.buildTime}` : ''}
            >
              V-{BUILD_META.shortVersion}
            </span>
          </div>

          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden w-10 h-10 border border-neon-blue bg-cyber-card text-neon-blue flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div key="close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <X size={24} />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Menu size={24} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-4 right-4 bg-cyber-dark/95 backdrop-blur-xl border-t-4 border-neon-pink p-6 z-[90] shadow-[0_20px_60px_rgba(0,0,0,0.8)] md:hidden"
          >
            <div className="flex flex-col gap-4">
              <span className="font-display text-4xl text-neon-blue mb-4 uppercase">Menü</span>
              {!isLoggedIn ? (
                NAV_ITEMS.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="flex items-center justify-between py-3 border-b border-cyber-border text-ink-100 font-sans uppercase tracking-widest text-lg hover:text-neon-pink"
                  >
                    {item.label}
                    <ChevronRight size={20} className="text-neon-blue" />
                  </button>
                ))
              ) : (
                <>
                  {user && (
                    <div className="flex items-center justify-between py-3 border-b border-cyber-border text-neon-blue font-sans uppercase tracking-widest text-lg">
                      <span className="flex items-center gap-2"><Wallet size={20} /> CÜZDAN</span>
                      <span className="font-display text-xl">{user.points} CP</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      navigate('/store');
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between py-3 border-b border-cyber-border text-ink-100 font-sans uppercase tracking-widest text-lg hover:text-neon-blue"
                  >
                    <span>MAĞAZA</span>
                    <ShoppingCart size={20} className="text-neon-blue" />
                  </button>
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsOpen(false);
                    }}
                    className="w-full py-4 mt-4 bg-neon-pink text-cyber-dark font-sans uppercase font-bold text-lg tracking-widest flex items-center justify-center gap-3"
                  >
                    <LogOut size={20} /> Çıkış Yap
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
