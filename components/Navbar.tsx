/**
 * Floating CafeDuo navigation; touch targets and native keyboard controls.
 *
 * Motion (plan step 17): panel rows enter in 20 ms steps and leave in reverse
 * order through the shared variants, the toggle icon rotates through the swap,
 * desktop links draw an ink underline on hover, and a backdrop click or
 * Escape closes the panel.
 */
import React, { useEffect, useState, useRef } from 'react';
import { Bell, Menu, X, Coffee, LogOut, ChevronRight, Wallet, Store } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS } from '../constants';
import { DURATION, EASE } from '../lib/motion';
import { HoverUnderline } from './ui/HoverUnderline';
import { menuBackdrop, menuItem, menuPanel } from './ui/motionVariants';
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
      <nav
        className="duo-nav riso-kantin"
        role="navigation"
        aria-label="Ana navigasyon"
      >
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
            <div className="flex h-9 w-9 items-center justify-center bg-riso-pink text-carbon">
              <Coffee size={18} strokeWidth={2.5} />
            </div>
            <span className="font-riso-display text-[28px] leading-none text-carbon">
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
                    <HoverUnderline>{item.label}</HoverUnderline>
                  </button>
                ))}
                <button
                  onClick={goToBusiness}
                  aria-current={isBusinessPage ? 'page' : undefined}
                  className={`duo-nav-link duo-nav-business riso-focus transition-all ${
                    isBusinessPage
                      ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                      : 'bg-paper text-carbon hover:shadow-[inset_0_-3px_0_#17140f]'
                  }`}
                >
                  <Store size={14} />
                  Kafeler
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {user && !isHomePage && (
                  <div className="flex min-h-11 items-center gap-2 bg-riso-spring px-3">
                    <Wallet size={16} className="text-carbon" aria-hidden="true" />
                    <span className="text-[15px] font-semibold text-carbon [font-variant-numeric:tabular-nums]">
                      {user.points} puan
                    </span>
                  </div>
                )}
                <button
                  onClick={onLogout}
                  data-testid="logout-button"
                  className="duo-quiet riso-focus gap-2 px-2"
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>Çıkış</span>
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
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={isOpen ? 'close' : 'open'}
                initial={{ rotate: -30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 30, opacity: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE.brand }}
                className="flex items-center justify-center"
              >
                {isOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="mobile-menu-backdrop"
              data-testid="mobile-menu-backdrop"
              variants={menuBackdrop}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => {
                setIsOpen(false);
                menuToggleRef.current?.focus();
              }}
              className="fixed inset-0 z-[85] bg-carbon/25 md:hidden"
              aria-hidden="true"
            />
            <motion.div
              key="mobile-menu"
              id="mobile-menu"
              variants={menuPanel}
              initial="hidden"
              animate="show"
              exit="exit"
              className="duo-mobile-menu riso-kantin flex flex-col gap-3 md:hidden"
              aria-hidden={false}
            >
              <motion.div variants={menuItem} className="flex items-center justify-between">
                <span className="font-riso-display text-lg text-carbon">Menü</span>
                {!isLoggedIn && <Bell size={18} className="text-carbon-muted" />}
              </motion.div>
              {!isLoggedIn ? (
                <>
                  {NAV_ITEMS.map((item) => (
                    <motion.button
                      key={item.id}
                      variants={menuItem}
                      onClick={() => scrollToSection(item.id)}
                      className="riso-focus flex items-center justify-between border-b-2 border-paper-dim py-3 font-riso-body text-base font-semibold text-carbon transition-colors hover:text-riso-pink-deep"
                    >
                      {item.label}
                      <ChevronRight size={20} className="text-carbon-muted" />
                    </motion.button>
                  ))}
                  <motion.button
                    variants={menuItem}
                    onClick={goToBusiness}
                    aria-current={isBusinessPage ? 'page' : undefined}
                    className="riso-focus mt-2 flex min-h-12 items-center justify-between bg-riso-pink px-4 font-riso-body text-base font-semibold text-carbon"
                  >
                    <span className="flex items-center gap-2">
                      <Store size={20} /> Kafe Sahipleri
                    </span>
                    <ChevronRight size={20} />
                  </motion.button>
                </>
              ) : (
                <>
                  {user && !isHomePage && (
                    <motion.div
                      variants={menuItem}
                      className="flex items-center justify-between border-b-2 border-paper-dim py-3 font-riso-body text-base font-semibold text-carbon"
                    >
                      <span className="flex items-center gap-2">
                        <Wallet size={20} /> Cüzdan
                      </span>
                      <span className="[font-variant-numeric:tabular-nums]">{user.points} puan</span>
                    </motion.div>
                  )}
                  <motion.button
                    variants={menuItem}
                    onClick={() => {
                      onLogout?.();
                      setIsOpen(false);
                    }}
                    className="riso-focus mt-3 flex min-h-12 w-full items-center justify-center gap-3 bg-carbon font-riso-body text-base font-semibold text-paper hover:bg-carbon-soft transition-colors"
                  >
                    <LogOut size={20} /> Çıkış Yap
                  </motion.button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
