/** Floating CafeDuo navigation; touch targets and native keyboard controls. */
import React, { useEffect, useState, useRef } from 'react';
import { Bell, Menu, X, Coffee, LogOut, ChevronRight, Wallet, Store } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS } from '../constants';
import type { User } from '../types';

interface NavbarProps {
  isLoggedIn?: boolean;
  user?: User | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isLoggedIn = false, user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isBusinessPage = location.pathname === '/kafeler';

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
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

  const goToBusiness = () => {
    setIsOpen(false);
    navigate('/kafeler');
  };

  return (
    <>
      <nav className="duo-nav riso-kantin" role="navigation" aria-label="Ana navigasyon">
        <div className="duo-nav-bar">
          <button
            type="button"
            className="duo-brand riso-focus transition-opacity hover:opacity-85"
            onClick={() => {
              if (isLoggedIn) navigate('/dashboard');
              else scrollToSection('home');
            }}
            aria-label="Ana sayfa"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-carbon bg-riso-pink text-carbon">
              <Coffee size={18} strokeWidth={2.5} />
            </div>
            <span className="font-riso-display text-lg sm:text-xl font-bold text-carbon">
              Cafe<span className="text-riso-pink-deep">Duo</span>
              <span className="sr-only">CafeDuo</span>
            </span>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {!isLoggedIn ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="duo-nav-link riso-focus"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={goToBusiness}
                  aria-current={isBusinessPage ? 'page' : undefined}
                  className={`duo-nav-link duo-nav-business riso-focus transition-all ${
                    isBusinessPage
                      ? 'bg-riso-mustard text-carbon riso-shadow-sm'
                      : 'bg-paper text-carbon hover:bg-riso-mustard hover:translate-x-[-1px] hover:translate-y-[-1px]'
                  }`}
                >
                  <Store size={14} />
                  Kafeler
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {user && !isHomePage && (
                  <div className="flex items-center gap-2 border-2 border-carbon bg-riso-mustard px-3 py-1.5">
                    <Wallet size={14} className="text-carbon" />
                    <span className="font-riso-mono text-sm font-bold text-carbon">
                      {user.points}
                      <span className="ml-1 text-[0.65rem] uppercase tracking-wider opacity-80">
                        CP
                      </span>
                    </span>
                  </div>
                )}
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="riso-focus riso-press flex items-center gap-2 border-2 border-carbon bg-riso-redox px-3 py-1.5 font-riso-body text-sm font-bold text-paper transition-all riso-shadow-sm"
                >
                  <LogOut size={16} />
                  <span className="hidden lg:inline">Çıkış</span>
                </button>
              </div>
            )}
          </div>

          <button
            ref={menuToggleRef}
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            className="duo-menu-toggle riso-focus md:hidden"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="duo-mobile-menu riso-kantin md:hidden"
            aria-hidden={false}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-riso-display text-lg text-carbon">Menü</span>
                {!isLoggedIn && <Bell size={18} className="text-carbon-muted" />}
              </div>
              {!isLoggedIn ? (
                <>
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="riso-focus flex items-center justify-between border-b-2 border-paper-dim py-3 font-riso-body text-base font-semibold text-carbon transition-colors hover:text-riso-pink-deep"
                    >
                      {item.label}
                      <ChevronRight size={20} className="text-carbon-muted" />
                    </button>
                  ))}
                  <button
                    onClick={goToBusiness}
                    aria-current={isBusinessPage ? 'page' : undefined}
                    className="riso-focus mt-2 flex items-center justify-between border-2 border-carbon bg-riso-mustard px-3 py-3 font-riso-body text-base font-bold uppercase tracking-[0.08em] text-carbon riso-shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Store size={20} /> Kafe Sahipleri
                    </span>
                    <ChevronRight size={20} />
                  </button>
                </>
              ) : (
                <>
                  {user && !isHomePage && (
                    <div className="flex items-center justify-between border-b-2 border-paper-dim py-3 font-riso-body text-base font-semibold text-carbon">
                      <span className="flex items-center gap-2">
                        <Wallet size={20} /> Cüzdan
                      </span>
                      <span className="font-riso-mono">{user.points} CP</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsOpen(false);
                    }}
                    className="riso-focus riso-press mt-3 flex w-full items-center justify-center gap-3 border-2 border-carbon bg-riso-redox py-3 font-riso-body text-base font-bold text-paper riso-shadow-sm"
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
