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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] w-[calc(100vw-2rem)] max-w-[32rem] pointer-events-auto">
      <div className="rf-screen-card noise-bg p-5 sm:p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shrink-0">
            <Cookie size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="rf-terminal-strip mb-3">Sistem Bilgisi</div>
            <h3 className="text-white font-bold mb-3 uppercase tracking-[0.08em] leading-tight">Çerez Kullanımı</h3>
            <p className="text-[var(--rf-muted)] text-sm leading-relaxed mb-5 break-words">
              Size daha iyi bir deneyim sunmak ve konum doğrulaması yapabilmek için çerezleri kullanıyoruz.
            </p>
            <button
              type="button"
              onClick={handleAccept}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#041226] py-3 text-sm font-bold transition-colors uppercase tracking-[0.08em]"
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
