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
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[92%] md:w-auto transition-transform duration-300"
        role="navigation"
        aria-label="Ana navigasyon"
      >
        <div className="cd-nav-shell rounded-md md:px-5 px-3.5 py-3 flex items-center justify-between gap-6">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
            role="button"
            tabIndex={0}
            aria-label="Ana sayfa"
            onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? navigate('/dashboard') : scrollToSection('home'))}
          >
            <div className="cd-brand-mark w-9 h-9 flex items-center justify-center rounded-md">
              <Coffee size={19} />
            </div>
            <span className="font-display-tr text-lg text-white tracking-[0.18em] uppercase">
              CafeDuo
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="px-3.5 py-2 text-xs font-sans tracking-[0.14em] text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-md transition-all uppercase"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/8 px-3 py-1.5 rounded-md">
                  <Sparkles size={14} className="text-emerald-300" />
                  <span className="font-sans text-xs text-emerald-200 uppercase font-bold tracking-widest">Canlı</span>
                </div>
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 border border-slate-700/50 rounded-md">
                    <Wallet size={14} className="text-slate-300" />
                    <span className="font-display-tr text-lg text-white">{user.points} <span className="text-[10px] text-slate-400">CP</span></span>
                  </div>
                )}
                <button
                  onClick={() => navigate('/store')}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-sans text-slate-200 border border-slate-700/60 rounded-md hover:border-sky-300/50 hover:bg-white/[0.06] transition-all uppercase font-bold"
                >
                  <ShoppingCart size={16} />
                  <span className="hidden lg:inline">Mağaza</span>
                </button>
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-sans text-slate-200 border border-slate-700/60 rounded-md hover:border-rose-300/50 hover:bg-white/[0.06] transition-all uppercase font-bold"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">Çıkış</span>
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

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            className="md:hidden w-10 h-10 border border-slate-700/60 bg-slate-950/40 rounded-md text-slate-300 flex items-center justify-center transition-colors hover:bg-white/[0.06]"
          >
            {isOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          id="mobile-menu"
          className="fixed bottom-24 left-4 right-4 cd-nav-shell rounded-md p-5 z-[90] shadow-2xl md:hidden animate-fade-in"
          aria-hidden={false}
        >
          <div className="flex flex-col gap-4">
            <span className="font-display-tr text-2xl text-white mb-2 uppercase tracking-wide">Menü</span>
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center justify-between py-3 border-b border-slate-700/50 text-slate-200 font-sans uppercase tracking-widest text-base hover:text-white transition-colors"
                >
                  {item.label}
                  <ChevronRight size={20} className="text-slate-500" />
                </button>
              ))
            ) : (
              <>
                {user && (
                  <div className="flex items-center justify-between py-3 border-b border-slate-700/50 text-slate-100 font-sans uppercase tracking-widest text-base">
                    <span className="flex items-center gap-2"><Wallet size={20} /> Cüzdan</span>
                    <span className="font-display-tr text-xl">{user.points} CP</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    navigate('/store');
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between py-3 border-b border-slate-700/50 text-slate-200 font-sans uppercase tracking-widest text-base hover:text-white transition-colors"
                >
                  <span>Mağaza</span>
                  <ShoppingCart size={20} className="text-slate-500" />
                </button>
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsOpen(false);
                  }}
                  className="w-full py-4 mt-3 cd-button-primary font-sans uppercase font-bold text-base tracking-widest flex items-center justify-center gap-3 rounded-md"
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
