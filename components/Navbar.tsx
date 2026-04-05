import React, { useState, useEffect } from 'react';
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
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] md:w-auto transition-transform duration-300"
        role="navigation"
        aria-label="Ana navigasyon"
      >
        <div className="glass border border-slate-700/40 rounded-2xl md:rounded-xl md:px-6 px-4 py-3 flex items-center justify-between gap-6 shadow-lg">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
            role="button"
            tabIndex={0}
            aria-label="Ana sayfa"
            onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? navigate('/dashboard') : scrollToSection('home'))}
          >
            <div className="w-9 h-9 bg-rose-500 text-white flex items-center justify-center rounded-lg">
              <Coffee size={20} />
            </div>
            <span className="font-display text-xl text-white uppercase tracking-widest">
              CafeDuo
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="px-4 py-2 text-sm font-sans tracking-widest text-slate-300 hover:text-sky-400 hover:bg-slate-800/50 rounded-lg transition-all uppercase"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 border-l-4 border-emerald-500 bg-slate-800/50 px-3 py-1.5 rounded-r-lg">
                  <Sparkles size={14} className="text-emerald-500" />
                  <span className="font-sans text-xs text-emerald-500 uppercase font-bold tracking-widest">Canlı</span>
                </div>
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-700/40 rounded-lg">
                    <Wallet size={14} className="text-pink-500" />
                    <span className="font-display text-lg text-sky-400">{user.points} <span className="text-[10px] text-pink-500">CP</span></span>
                  </div>
                )}
                <button
                  onClick={() => navigate('/store')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-sky-400 border border-sky-500/40 rounded-lg hover:bg-sky-500 hover:text-white transition-all uppercase font-bold"
                >
                  <ShoppingCart size={16} />
                  <span className="hidden lg:inline">MAĞAZA</span>
                </button>
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-rose-400 border border-rose-500/40 rounded-lg hover:bg-rose-500 hover:text-white transition-all uppercase font-bold"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">ÇIKIŞ</span>
                </button>
              </div>
            )}
            <span
              className="text-[10px] text-slate-500 font-sans tracking-widest uppercase ml-3 hidden lg:block"
              title={BUILD_META.buildTime !== 'unknown' ? `Build: ${BUILD_META.buildTime}` : ''}
            >
              V-{BUILD_META.shortVersion}
            </span>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            className="md:hidden w-10 h-10 border border-slate-700/40 bg-slate-800/50 rounded-lg text-slate-300 flex items-center justify-center transition-colors hover:bg-slate-800"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="fixed bottom-24 left-4 right-4 glass border-t-4 border-rose-500 rounded-2xl p-6 z-[90] shadow-2xl md:hidden animate-fade-in"
          aria-hidden={false}
        >
          <div className="flex flex-col gap-4">
            <span className="font-display text-3xl text-white mb-3 uppercase">Menü</span>
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center justify-between py-3 border-b border-slate-700/40 text-slate-200 font-sans uppercase tracking-widest text-lg hover:text-rose-400 transition-colors"
                >
                  {item.label}
                  <ChevronRight size={20} className="text-slate-500" />
                </button>
              ))
            ) : (
              <>
                {user && (
                  <div className="flex items-center justify-between py-3 border-b border-slate-700/40 text-sky-400 font-sans uppercase tracking-widest text-lg">
                    <span className="flex items-center gap-2"><Wallet size={20} /> CÜZDAN</span>
                    <span className="font-display text-xl">{user.points} CP</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    navigate('/store');
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between py-3 border-b border-slate-700/40 text-slate-200 font-sans uppercase tracking-widest text-lg hover:text-sky-400 transition-colors"
                >
                  <span>MAĞAZA</span>
                  <ShoppingCart size={20} className="text-slate-500" />
                </button>
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsOpen(false);
                  }}
                  className="w-full py-4 mt-3 bg-rose-500 text-white font-sans uppercase font-bold text-lg tracking-widest flex items-center justify-center gap-3 rounded-lg"
                >
                  <LogOut size={20} /> Çıkış Yap
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
