import React from 'react';
import { Instagram, Twitter, Mail, Shield, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BUILD_META } from '../lib/buildMeta';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-8 border-t border-cyan-400/24 bg-[linear-gradient(180deg,#040b1a,#040915)]" role="contentinfo">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-500/12 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="grid md:grid-cols-3 gap-7 items-start">
          <div>
            <span className="font-display text-3xl text-white block">CafeDuo</span>
            <p className="mt-2 text-sm text-[var(--rf-muted)]">
              Kafede bekleyen kullanıcıları eşleştirip oyun ve ödül döngüsüne bağlayan sosyal deneyim altyapısı.
            </p>
            <p className="mt-3 font-pixel text-[10px] tracking-[0.2em] uppercase text-cyan-300/75">
              © {year} tüm hakları saklıdır
            </p>
            <span
              className="rf-version-pill mt-2"
              data-testid="footer-version-pill"
              title={BUILD_META.buildTime !== 'unknown' ? `Build: ${BUILD_META.buildTime}` : 'Build bilgisi yok'}
            >
              v-{BUILD_META.shortVersion}
            </span>
          </div>

          <div className="space-y-2">
            <p className="font-pixel text-[10px] tracking-[0.2em] uppercase text-cyan-300/75">Yasal</p>
            <Link
              to="/gizlilik"
              className="inline-flex items-center gap-2 text-cyan-100 hover:text-cyan-300 transition-colors"
            >
              <Shield size={15} />
              Gizlilik Politikası & KVKK
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div>
            <p className="font-pixel text-[10px] tracking-[0.2em] uppercase text-cyan-300/75 mb-3">İletişim</p>
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/cafeduotr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-cyan-400/35 bg-[#0a1834]/85 flex items-center justify-center text-cyan-100 hover:text-cyan-300 hover:border-cyan-300/58 transition-colors"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://x.com/cafeduotr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="w-10 h-10 rounded-full border border-cyan-400/35 bg-[#0a1834]/85 flex items-center justify-center text-cyan-100 hover:text-cyan-300 hover:border-cyan-300/58 transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="mailto:cafeduotr@gmail.com"
                aria-label="E-posta"
                className="w-10 h-10 rounded-full border border-cyan-400/35 bg-[#0a1834]/85 flex items-center justify-center text-cyan-100 hover:text-cyan-300 hover:border-cyan-300/58 transition-colors"
              >
                <Mail size={18} />
              </a>
            </div>
            <a
              href="mailto:cafeduotr@gmail.com"
              className="inline-flex mt-3 text-sm text-cyan-200 hover:text-cyan-300 transition-colors"
            >
              cafeduotr@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
