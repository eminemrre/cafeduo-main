import React, { useEffect, useState } from 'react';
import { Menu, X, Coffee, LogOut, ChevronRight, Sparkles, ShoppingCart, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
        className="fixed bottom-5 left-1/2 z-[100] w-[92%] -translate-x-1/2 transition-transform duration-300 md:w-auto"
        role="navigation"
        aria-label="Ana navigasyon"
      >
        <div className="cd-nav-shell flex items-center justify-between gap-5 rounded-md px-3.5 py-3 md:px-5">
          <div
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-85"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
            role="button"
            tabIndex={0}
            aria-label="Ana sayfa"
            onKeyDown={(event) => event.key === 'Enter' && (isLoggedIn ? navigate('/dashboard') : scrollToSection('home'))}
          >
            <div className="cd-brand-mark flex h-9 w-9 items-center justify-center rounded-md">
              <Coffee size={19} />
            </div>
            <span className="font-display-tr text-base uppercase tracking-[0.16em] text-white sm:text-lg">
              CafeDuo
            </span>
          </div>

          <div className="hidden items-center gap-1.5 md:flex">
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5">
                  <Sparkles size={14} className="text-emerald-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-100">Canlı</span>
                </div>
                {user && (
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    <Wallet size={14} className="text-slate-300" />
                    <span className="font-display-tr text-lg text-white">
                      {user.points} <span className="text-[10px] text-slate-400">CP</span>
                    </span>
                  </div>
                )}
                <button
                  onClick={() => navigate('/store')}
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3.5 py-2 text-sm font-bold uppercase text-slate-200 transition-all hover:border-sky-200/40 hover:bg-white/[0.06]"
                >
                  <ShoppingCart size={16} />
                  <span className="hidden lg:inline">Mağaza</span>
                </button>
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="flex items-center gap-2 rounded-md border border-white/10 px-3.5 py-2 text-sm font-bold uppercase text-slate-200 transition-all hover:border-rose-200/40 hover:bg-white/[0.06]"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">Çıkış</span>
                </button>
              </div>
            )}
            <span
              className="ml-3 hidden text-[10px] uppercase tracking-widest text-slate-500 lg:block"
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
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/[0.08] md:hidden"
          >
            {isOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          id="mobile-menu"
          className="cd-nav-shell fixed bottom-24 left-4 right-4 z-[90] rounded-md p-5 shadow-2xl md:hidden"
          aria-hidden={false}
        >
          <div className="flex flex-col gap-4">
            <span className="font-display-tr text-2xl uppercase tracking-wide text-white">Menü</span>
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold uppercase tracking-widest text-slate-200 transition-colors hover:text-white"
                >
                  {item.label}
                  <ChevronRight size={20} className="text-slate-500" />
                </button>
              ))
            ) : (
              <>
                {user && (
                  <div className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold uppercase tracking-widest text-slate-100">
                    <span className="flex items-center gap-2"><Wallet size={20} /> Cüzdan</span>
                    <span className="font-display-tr text-xl">{user.points} CP</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    navigate('/store');
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold uppercase tracking-widest text-slate-200 transition-colors hover:text-white"
                >
                  <span>Mağaza</span>
                  <ShoppingCart size={20} className="text-slate-500" />
                </button>
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsOpen(false);
                  }}
                  className="cd-button-primary mt-3 flex w-full items-center justify-center gap-3 rounded-md py-4 text-base font-bold uppercase tracking-widest"
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
