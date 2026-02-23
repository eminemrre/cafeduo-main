import React, { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';

const CONSENT_KEY = 'cookie_consent';

export const CookieConsent: React.FC = () => {
  const [hydrated, setHydrated] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY) === 'true';
    setConsentAccepted(consent);
    setPanelOpen(!consent);
    setHydrated(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    setConsentAccepted(true);
    setPanelOpen(false);
  };

  if (!hydrated) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen((prev) => !prev)}
        className="fixed cookie-floating-anchor right-3 sm:right-4 z-[120] pointer-events-auto inline-flex items-center gap-2 px-3 py-2 bg-[#07152f]/95 border border-cyan-400/45 text-cyan-100 hover:text-cyan-300 hover:border-cyan-300/70 transition-colors uppercase tracking-[0.12em] text-[11px] font-semibold backdrop-blur-sm"
        aria-label="Çerez Tercihleri"
        aria-expanded={panelOpen}
      >
        <Settings2 size={14} />
        Çerez Tercihleri
      </button>

      {panelOpen && (
        <div className="fixed cookie-consent-panel cookie-panel-anchor left-auto right-3 sm:right-4 w-[calc(100vw-1.5rem)] sm:w-[26rem] max-w-[26rem] pointer-events-auto rf-screen-card noise-bg p-4 sm:p-5 z-[121] animate-slide-up max-h-[min(22rem,calc(100vh-10rem))] overflow-y-auto">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shrink-0">
              <Cookie size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="rf-terminal-strip mb-2">Sistem Uyarısı</div>
              <h3 className="text-white font-bold mb-2 uppercase tracking-[0.08em] leading-tight">Çerez Politikası</h3>
              <p className="text-[var(--rf-muted)] text-sm leading-relaxed mb-4 break-words">
                Size daha iyi bir deneyim sunmak ve konum doğrulaması yapabilmek için çerezleri kullanıyoruz.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAccept}
                  className="flex-1 min-w-[11rem] bg-cyan-500 hover:bg-cyan-400 text-[#041226] py-2 text-sm font-bold transition-colors uppercase tracking-[0.08em]"
                >
                  Kabul Et
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="p-2 hover:bg-white/10 text-[var(--rf-muted)] transition-colors border border-cyan-500/20"
                  aria-label="Çerez panelini kapat"
                >
                  <X size={20} />
                </button>
              </div>
              {consentAccepted && (
                <p className="mt-3 text-xs text-cyan-300/80">Tercihiniz kaydedildi. İstediğiniz zaman tekrar açabilirsiniz.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
