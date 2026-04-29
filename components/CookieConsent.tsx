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
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setShowBanner(false);
  };

  if (!hydrated || !showBanner || !portalRoot) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className="pointer-events-none fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-[90] md:bottom-24 md:left-auto md:right-6 md:w-[26rem]"
    >
      <div className="pointer-events-auto rounded-md border border-white/10 bg-[#0a1018]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-3.5">
        <div className="flex items-start gap-3">
          <div className="hidden shrink-0 rounded-md border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 sm:flex">
            <Cookie size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Sistem bilgisi</p>
            <h3 className="mb-1.5 text-sm font-bold uppercase tracking-[0.08em] text-white sm:text-base">Çerez Kullanımı</h3>
            <p className="mb-2.5 break-words text-xs leading-5 text-slate-400 sm:text-[13px]">
              Deneyim ve konum doğrulaması için gerekli çerezleri kullanıyoruz.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              className="w-full rounded-md bg-slate-100 py-2.5 text-sm font-bold uppercase tracking-[0.08em] text-[#07111f] transition-colors hover:bg-white"
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
