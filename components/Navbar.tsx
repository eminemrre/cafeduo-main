import React, { useState, useEffect } from 'react';
import { Menu, X, Coffee, LogOut, User } from 'lucide-react';
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
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled || isLoggedIn ? 'bg-slate-900/95 backdrop-blur-md shadow-lg py-2' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex-shrink-0 flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              if (!isLoggedIn) {
                scrollToSection('home');
              }
            }}
          >
            <div className="bg-white text-black rounded-full p-1.5 group-hover:rotate-12 transition-transform">
              <Coffee size={24} strokeWidth={3} />
            </div>
            <span className="font-pixel text-3xl text-white tracking-wider">
              CAFE<span className="text-slate-400 text-xl align-top">DUO</span>
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {!isLoggedIn ? (
                NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 font-pixel"
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-pixel text-sm text-gray-300">ONLINE</span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 font-pixel border border-transparent hover:border-red-500/50"
                  >
                    <LogOut size={16} />
                    ÇIKIŞ YAP
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-white p-2 rounded-md focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 backdrop-blur-xl">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {!isLoggedIn ? (
              NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-gray-300 hover:text-white block w-full text-left px-3 py-4 rounded-md text-base font-pixel border-b border-slate-800 last:border-0"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  setIsOpen(false);
                }}
                className="text-red-400 hover:text-red-300 block w-full text-left px-3 py-4 rounded-md text-base font-pixel border-b border-slate-800"
              >
                ÇIKIŞ YAP
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};