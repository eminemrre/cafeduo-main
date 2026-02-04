import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Coffee, LogOut, User, ChevronRight } from 'lucide-react';
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
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const scrollToSection = (id: string) => {
    setIsOpen(false);
    if (!isLoggedIn) {
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <>
      <nav 
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled || isLoggedIn 
            ? 'bg-slate-900/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] py-2' 
            : 'bg-transparent py-4 md:py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-shrink-0 flex items-center gap-2 cursor-pointer group"
              onClick={() => {
                if (!isLoggedIn) {
                  scrollToSection('home');
                } else {
                  navigate('/dashboard');
                }
              }}
            >
              <motion.div 
                className="bg-white text-black rounded-full p-1.5 shadow-[0_8px_20px_rgba(255,255,255,0.2)]"
                whileHover={{ rotate: 12 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Coffee size={22} strokeWidth={3} />
              </motion.div>
              <span className="font-pixel text-2xl md:text-3xl text-white tracking-wider">
                CAFE<span className="text-slate-400 text-lg md:text-xl align-top">DUO</span>
              </span>
            </motion.div>

            {/* Desktop Menu */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-2">
                {!isLoggedIn ? (
                  NAV_ITEMS.map((item, index) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => scrollToSection(item.id)}
                      className="relative text-gray-300 hover:text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 font-pixel border border-transparent hover:border-white/10 hover:bg-white/5"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {item.label}
                    </motion.button>
                  ))
                ) : (
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-600 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <motion.div 
                        className="w-2 h-2 rounded-full bg-green-500"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                      <span className="font-pixel text-xs text-gray-300">ONLINE</span>
                    </motion.div>
                    <motion.button
                      onClick={onLogout}
                      data-testid="logout-button"
                      className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 font-pixel border border-transparent hover:border-red-500/50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <LogOut size={16} />
                      <span className="hidden lg:inline">ÇIKIŞ YAP</span>
                    </motion.button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden relative w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              whileTap={{ scale: 0.9 }}
              aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X size={24} className="text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu size={24} className="text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-slate-900 z-50 md:hidden shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <span className="font-pixel text-white text-lg">MENÜ</span>
                <motion.button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={20} className="text-white" />
                </motion.button>
              </div>

              {/* Menu Items */}
              <div className="p-4 space-y-2">
                {!isLoggedIn ? (
                  NAV_ITEMS.map((item, index) => (
                    <motion.button
                      key={item.id}
                      initial={{ x: 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => scrollToSection(item.id)}
                      className="w-full flex items-center justify-between text-gray-300 hover:text-white hover:bg-white/5 px-4 py-4 rounded-xl text-base font-pixel transition-colors"
                    >
                      {item.label}
                      <ChevronRight size={18} className="text-gray-600" />
                    </motion.button>
                  ))
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <User size={20} className="text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Kullanıcı</p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs text-gray-400">Çevrimiçi</span>
                        </div>
                      </div>
                    </div>
                    
                    <motion.button
                      initial={{ x: 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      onClick={() => {
                        if (onLogout) onLogout();
                        setIsOpen(false);
                      }}
                      data-testid="logout-button-mobile"
                      className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-4 rounded-xl text-base font-pixel transition-colors border border-red-500/20"
                    >
                      <LogOut size={20} />
                      ÇIKIŞ YAP
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <Coffee size={14} />
                  <span>CafeDuo v1.0</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
