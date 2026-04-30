import React, { useEffect, useState } from 'react';
import { Bell, Menu, X, Coffee, LogOut, ChevronRight, ShoppingCart, Wallet } from 'lucide-react';
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
  const isHomePage = location.pathname === '/';

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
        className="fixed left-1/2 top-4 z-[100] w-[96%] max-w-[1320px] -translate-x-1/2 transition-transform duration-300"
        role="navigation"
        aria-label="Ana navigasyon"
      >
        <div className="cd-nav-shell flex items-center justify-between gap-4 px-4 py-3 md:px-5">
          <div
            className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-85"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
            role="button"
            tabIndex={0}
            aria-label="Ana sayfa"
            onKeyDown={(event) => event.key === 'Enter' && (isLoggedIn ? navigate('/dashboard') : scrollToSection('home'))}
          >
            <div className="cd-brand-mark flex h-9 w-9 items-center justify-center">
              <Coffee size={18} />
            </div>
            <span className="font-pixel text-sm font-black text-white">
              Cafe<span className="text-[#ff3045]">Duo</span>
              <span className="sr-only">CafeDuo</span>
            </span>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {!isLoggedIn ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="cd-nav-link px-4 py-2 text-xs font-bold uppercase text-neutral-400 transition-all hover:text-white"
                  >
                    {item.label}
                  </button>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {user && !isHomePage && (
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
                    <Wallet size={14} className="text-[#ff2d3d]" />
                    <span className="text-sm font-bold text-white">
                      {user.points} <span className="text-xs text-neutral-500">CP</span>
                    </span>
                  </div>
                )}
                {!isHomePage && (
                  <button
                    onClick={() => navigate('/store')}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-neutral-300 transition-all hover:bg-white/[0.04] hover:text-white"
                  >
                    <ShoppingCart size={16} />
                    <span className="hidden lg:inline">Mağaza</span>
                  </button>
                )}
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="flex items-center gap-2 rounded-full bg-[#ff2d3d] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#ff4d5a]"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">Çıkış</span>
                </button>
              </div>
            )}
            <span
              className="ml-2 hidden text-[10px] uppercase tracking-widest text-neutral-700 lg:block"
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
            className="flex h-10 w-10 items-center justify-center border border-white/10 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08] md:hidden"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          id="mobile-menu"
          className="cd-nav-shell fixed left-4 right-4 top-20 z-[90] rounded-[28px] p-5 shadow-2xl md:hidden"
          aria-hidden={false}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-lg text-white">MENÜ</span>
              {!isLoggedIn && <Bell size={18} className="text-[#a5adb8]" />}
            </div>
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold text-neutral-200 transition-colors hover:text-white"
                >
                  {item.label}
                  <ChevronRight size={20} className="text-neutral-600" />
                </button>
              ))
            ) : (
              <>
                {user && !isHomePage && (
                  <div className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold text-white">
                    <span className="flex items-center gap-2"><Wallet size={20} /> Cüzdan</span>
                    <span>{user.points} CP</span>
                  </div>
                )}
                {!isHomePage && (
                  <button
                    onClick={() => {
                      navigate('/store');
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between border-b border-white/10 py-3 text-base font-semibold text-neutral-200 transition-colors hover:text-white"
                  >
                    <span>Mağaza</span>
                    <ShoppingCart size={20} className="text-neutral-600" />
                  </button>
                )}
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsOpen(false);
                  }}
                  className="cd-button-primary mt-3 flex w-full items-center justify-center gap-3 py-4 text-base font-bold"
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
