import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Coffee, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';

interface NavbarProps {
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn = false, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || isLoggedIn
            ? 'bg-[#060d1e]/80 backdrop-blur-xl border-b border-cyan-400/20 py-2 shadow-[0_16px_36px_rgba(0,0,0,0.45)]'
            : 'bg-transparent py-4 md:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <motion.div
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 md:gap-3 cursor-pointer min-w-0"
              onClick={() => {
                if (isLoggedIn) {
                  navigate('/dashboard');
                } else {
                  scrollToSection('home');
                }
              }}
            >
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-500 text-[#021022] flex items-center justify-center shadow-[0_0_24px_rgba(0,217,255,0.45)] shrink-0">
                <Coffee size={19} />
              </div>
              <div className="leading-tight min-w-0">
                <span className="font-display text-[1.95rem] max-[430px]:text-[1.7rem] md:text-[1.65rem] text-cyan-100 block tracking-wide truncate">CafeDuo</span>
                <span className="font-pixel text-[10px] tracking-[0.24em] text-cyan-300/80 block -mt-1 max-[430px]:hidden">
                  SOCIAL CAFE ENGINE
                </span>
              </div>
            </motion.div>

            <div className="hidden md:flex items-center gap-2">
              {!isLoggedIn ? (
                NAV_ITEMS.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    onClick={() => scrollToSection(item.id)}
                    className="px-4 py-2 rounded-full text-sm font-pixel tracking-wide text-cyan-100/90 hover:text-white hover:bg-cyan-500/15 border border-transparent hover:border-cyan-300/35 transition-all"
                  >
                    {item.label}
                  </motion.button>
                ))
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5">
                    <Sparkles size={14} className="text-cyan-300" />
                    <span className="font-pixel text-xs text-cyan-100">CANLI OTURUM</span>
                  </div>
                  <motion.button
                    onClick={onLogout}
                    data-testid="logout-button"
                    className="flex items-center gap-2 rounded-full border border-pink-400/40 px-4 py-2 text-sm font-pixel text-pink-100 hover:bg-pink-500/15 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogOut size={16} />
                    <span className="hidden lg:inline">ÇIKIŞ YAP</span>
                  </motion.button>
                </div>
              )}
            </div>

            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden w-11 h-11 rounded-full border border-cyan-300/35 bg-[#0b1630]/90 text-cyan-100 flex items-center justify-center"
              whileTap={{ scale: 0.93 }}
              aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <X size={22} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Menu size={22} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#020611]/75 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 290 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] bg-[#060d1e] border-l border-cyan-500/30 z-50 md:hidden shadow-[0_20px_44px_rgba(0,0,0,0.52)]"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/25">
                <span className="font-pixel text-cyan-100 text-lg">MENÜ</span>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Panel menüsünü kapat"
                  data-testid="mobile-menu-close-button"
                  className="w-9 h-9 rounded-full border border-cyan-400/40 flex items-center justify-center text-cyan-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {!isLoggedIn ? (
                  NAV_ITEMS.map((item, index) => (
                    <motion.button
                      key={item.id}
                      initial={{ x: 36, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.08 }}
                      onClick={() => scrollToSection(item.id)}
                      className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-cyan-50 hover:bg-cyan-500/15 transition-colors font-pixel text-sm border border-transparent hover:border-cyan-400/30"
                    >
                      {item.label}
                      <ChevronRight size={16} className="text-cyan-300/80" />
                    </motion.button>
                  ))
                ) : (
                  <>
                    <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-pixel mb-1">Durum</p>
                      <p className="text-sm text-cyan-50">Oturum açık. Panele güvenli şekilde dönebilirsin.</p>
                    </div>
                    <motion.button
                      initial={{ x: 36, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      onClick={() => {
                        onLogout?.();
                        setIsOpen(false);
                      }}
                      data-testid="logout-button-mobile"
                      className="w-full flex items-center gap-3 rounded-xl border border-pink-400/45 px-4 py-3 text-pink-100 font-pixel hover:bg-pink-500/15"
                    >
                      <LogOut size={18} />
                      ÇIKIŞ YAP
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
