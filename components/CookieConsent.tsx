import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'cookie_consent';

export const CookieConsent: React.FC = () => {
  const [hydrated, setHydrated] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const portalRoot = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  useEffect(() => {
    setHydrated(true);
    const consent = localStorage.getItem(CONSENT_KEY);
    // Only show banner if user hasn't consented yet
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    // Store consent only after user explicitly clicks
    localStorage.setItem(CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  if (!hydrated || !showBanner || !portalRoot) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-[90] pointer-events-none md:bottom-6 md:left-auto md:right-6 md:w-[26rem]"
    >
      <div className="pointer-events-auto rounded-md border border-slate-700/60 bg-[#080d16]/95 p-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex p-2.5 bg-slate-950/60 text-slate-200 border border-slate-700/60 rounded-md shrink-0">
            <Cookie size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="rf-terminal-strip mb-1.5">Sistem Bilgisi</div>
            <h3 className="text-white font-bold mb-2 uppercase tracking-[0.08em] leading-tight">Çerez Kullanımı</h3>
            <p className="text-[var(--rf-muted)] text-[13px] leading-relaxed mb-3 break-words">
              Size daha iyi bir deneyim sunmak ve konum doğrulaması yapabilmek için çerezleri kullanıyoruz.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              className="w-full rounded-md bg-slate-100 hover:bg-white text-[#07111f] py-2.5 text-sm font-bold transition-colors uppercase tracking-[0.08em]"
            >
              Anladım
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
};
