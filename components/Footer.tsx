import React from 'react';
import { Instagram, Twitter, Mail, Shield, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BUILD_META } from '../lib/buildMeta';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-8 border-t border-slate-800/50 bg-gradient-to-b from-slate-950 to-slate-950" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-7 items-start">
          <div>
            <span className="font-display text-3xl text-white block">CafeDuo</span>
            <p className="mt-2 text-sm text-slate-400">
              Kafede bekleyen kullanıcıları eşleştirip oyun ve ödül döngüsüne bağlayan sosyal deneyim altyapısı.
            </p>
            <p className="mt-3 text-[10px] tracking-wider uppercase text-slate-500">
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
            <p className="text-[10px] tracking-wider uppercase text-slate-500">Yasal</p>
            <Link
              to="/gizlilik"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-sky-400 transition-colors"
            >
              <Shield size={15} />
              Gizlilik Politikası & KVKK
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div>
            <p className="text-[10px] tracking-wider uppercase text-slate-500 mb-3">İletişim</p>
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/cafeduotr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full border border-slate-700/50 bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-sky-400 hover:border-sky-500/50 transition-all"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://x.com/cafeduotr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="w-10 h-10 rounded-full border border-slate-700/50 bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-sky-400 hover:border-sky-500/50 transition-all"
              >
                <Twitter size={18} />
              </a>
              <a
                href="mailto:cafeduotr@gmail.com"
                aria-label="E-posta"
                className="w-10 h-10 rounded-full border border-slate-700/50 bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-sky-400 hover:border-sky-500/50 transition-all"
              >
                <Mail size={18} />
              </a>
            </div>
            <a
              href="mailto:cafeduotr@gmail.com"
              className="inline-flex mt-3 text-sm text-slate-400 hover:text-sky-400 transition-colors"
            >
              cafeduotr@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
