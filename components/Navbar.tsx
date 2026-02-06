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
    const handleScroll = () => setScrolled(window.scrollY > 16);
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
            ? 'bg-[#fbf7f1]/88 backdrop-blur-xl border-b border-[#d7c3ad] py-2 shadow-[0_14px_28px_rgba(30,26,21,0.08)]'
            : 'bg-transparent py-4 md:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                if (isLoggedIn) {
                  navigate('/dashboard');
                } else {
                  scrollToSection('home');
                }
              }}
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1f6f78] to-[#be7b43] text-white flex items-center justify-center shadow-[0_10px_20px_rgba(31,111,120,0.28)]">
                <Coffee size={20} />
              </div>
              <div className="leading-tight">
                <span className="font-display text-2xl md:text-[1.75rem] text-[#1f2328] block">CafeDuo</span>
                <span className="font-pixel text-[10px] tracking-[0.28em] text-[#58616d] block -mt-1">
                  SOCIAL CAFE ENGINE
                </span>
              </div>
            </motion.div>

            <div className="hidden md:flex items-center gap-2">
              {!isLoggedIn ? (
                NAV_ITEMS.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    onClick={() => scrollToSection(item.id)}
                    className="px-4 py-2 rounded-full text-sm font-pixel tracking-wide text-[#37424f] hover:text-[#1f6f78] hover:bg-[#fff8ee] border border-transparent hover:border-[#d3b99f] transition-all"
                  >
                    {item.label}
                  </motion.button>
                ))
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-[#d3b99f] bg-[#fffaf3] px-3 py-1.5">
                    <Sparkles size={14} className="text-[#be7b43]" />
                    <span className="font-pixel text-xs text-[#3f4b57]">CANLI OTURUM</span>
                  </div>
                  <motion.button
                    onClick={onLogout}
                    data-testid="logout-button"
                    className="flex items-center gap-2 rounded-full border border-[#d3b99f] px-4 py-2 text-sm font-pixel text-[#613024] hover:bg-[#fff4eb] transition-colors"
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
              className="md:hidden w-11 h-11 rounded-full border border-[#cfb79f] bg-[#fff8ee] text-[#1f2328] flex items-center justify-center"
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
              className="fixed inset-0 bg-[#24170f]/35 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 290 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] bg-[#fff9f1] border-l border-[#d3b99f] z-50 md:hidden shadow-[0_18px_40px_rgba(30,20,12,0.22)]"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#dfc8b1]">
                <span className="font-pixel text-[#1f2328] text-lg">MENÜ</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-full border border-[#cfb79f] flex items-center justify-center text-[#1f2328]"
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
                      className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-[#34404c] hover:bg-[#f2e5d6] transition-colors font-pixel text-sm"
                    >
                      {item.label}
                      <ChevronRight size={16} className="text-[#66727f]" />
                    </motion.button>
                  ))
                ) : (
                  <>
                    <div className="rounded-xl border border-[#d8c2ab] bg-[#fff5e8] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7a5a3f] font-pixel mb-1">Durum</p>
                      <p className="text-sm text-[#2f3a46]">Oturum açık. Paneline güvenli şekilde dönebilirsin.</p>
                    </div>
                    <motion.button
                      initial={{ x: 36, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      onClick={() => {
                        onLogout?.();
                        setIsOpen(false);
                      }}
                      data-testid="logout-button-mobile"
                      className="w-full flex items-center gap-3 rounded-xl border border-[#d6baa1] px-4 py-3 text-[#6b3528] font-pixel"
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
