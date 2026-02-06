import React from 'react';
import { Instagram, Twitter, Mail, Shield, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-8 border-t border-[#d5bea6] bg-[#f3e7d8]">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fff6ea] to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="grid md:grid-cols-3 gap-7 items-start">
          <div>
            <span className="font-display text-3xl text-[#1f2328] block">CafeDuo</span>
            <p className="mt-2 text-sm text-[#5a6673]">
              Kahve mekani ile oyunu birlestiren sosyal deneyim platformu.
            </p>
            <p className="mt-3 font-pixel text-[10px] tracking-[0.2em] uppercase text-[#7a5f45]">
              © {year} tum haklari saklidir
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-pixel text-[10px] tracking-[0.2em] uppercase text-[#7a5f45]">Yasal</p>
            <Link
              to="/gizlilik"
              className="inline-flex items-center gap-2 text-[#31404c] hover:text-[#1f6f78] transition-colors"
            >
              <Shield size={15} />
              Gizlilik Politikasi & KVKK
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div>
            <p className="font-pixel text-[10px] tracking-[0.2em] uppercase text-[#7a5f45] mb-3">Iletisim</p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-[#cfb79f] bg-white/70 flex items-center justify-center text-[#3f4a56] hover:text-[#1f6f78] hover:border-[#1f6f78]/40 transition-colors"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="w-10 h-10 rounded-full border border-[#cfb79f] bg-white/70 flex items-center justify-center text-[#3f4a56] hover:text-[#1f6f78] hover:border-[#1f6f78]/40 transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="mailto:kvkk@cafeduo.com"
                aria-label="E-posta"
                className="w-10 h-10 rounded-full border border-[#cfb79f] bg-white/70 flex items-center justify-center text-[#3f4a56] hover:text-[#1f6f78] hover:border-[#1f6f78]/40 transition-colors"
              >
                <Mail size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
