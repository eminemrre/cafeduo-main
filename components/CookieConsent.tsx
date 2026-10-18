/**
 * CookieConsent — non-blocking corner banner with explicit accept/reject.
 *
 * The previous version was a full-screen modal that gated the homepage
 * itself, which annoyed users who just wanted to browse the landing page.
 * Now the banner is a dismissible card pinned to the bottom-right (mobile:
 * bottom inset) — the rest of the app stays interactive behind it.
 *
 * Stored values (localStorage.cookie_consent):
 *   - 'accepted' — dismissed, banner gone, auth flows allowed.
 *   - 'rejected' — dismissed, banner gone, AuthModal.handleSubmit will block
 *                  login/register and re-open this banner in pending state.
 *   - missing    — first visit; banner shown.
 *   - legacy 'true' is treated as 'accepted' for back-compat.
 *
 * The enforcement is intentionally *only* on auth (login/register). Browsing
 * the landing pages doesn't require consent — we only set cookies after the
 * user actually logs in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'cookie_consent';

export type CookieConsentValue = 'accepted' | 'rejected' | 'pending';

export const readCookieConsent = (): CookieConsentValue => {
  if (typeof window === 'undefined') return 'pending';
  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (raw === 'true' || raw === 'accepted') return 'accepted';
  if (raw === 'false' || raw === 'rejected') return 'rejected';
  return 'pending';
};

export const CookieConsent: React.FC = () => {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<CookieConsentValue>('pending');
  const portalRoot = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  useEffect(() => {
    setHydrated(true);
    setState(readCookieConsent());

    // Re-read consent on the custom event AuthModal dispatches when it wipes
    // a rejected/missing value. Also listen to storage to stay in sync if
    // the user toggled consent in another tab.
    const refresh = () => setState(readCookieConsent());
    window.addEventListener('cookie-consent-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('cookie-consent-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setState('accepted');
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    setState('rejected');
  };

  if (!hydrated || !portalRoot) return null;

  // Only 'pending' shows the banner. 'accepted' obviously hides it; 'rejected'
  // also hides it so the user can browse — auth flows will re-open the banner
  // when they actually try to sign in.
  if (state !== 'pending') return null;

  return createPortal(
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className="riso-kantin pointer-events-none fixed bottom-4 left-4 right-4 z-[130] sm:left-auto sm:right-6 sm:bottom-6 sm:w-[24rem]"
    >
      <div className="duo-cookie-card pointer-events-auto relative border-2 border-carbon bg-paper p-4 riso-shadow-md">
        {/* Sticker accent */}
        <div
          aria-hidden="true"
          className="absolute -top-2 right-6 h-2 w-12 bg-riso-mustard rotate-[-4deg] pointer-events-none hidden sm:block"
        />
        <button
          type="button"
          onClick={handleReject}
          aria-label="Reddet ve kapat"
          className="riso-focus absolute top-2 right-2 w-7 h-7 border-2 border-carbon bg-paper text-carbon hover:bg-paper-deep flex items-center justify-center"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <div className="shrink-0 border-2 border-carbon bg-riso-mustard p-2 text-carbon flex">
            <Cookie size={18} />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-carbon-muted font-riso-mono">
              Küçük bir bilgi
            </p>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.06em] text-carbon font-riso-display">
              Çerez Kullanımı
            </h3>
            <p className="mb-3 break-words text-xs leading-5 text-carbon-soft font-riso-body">
              Giriş yapmak için çerezleri kabul etmen gerekir. Sadece anasayfayı gezeceksen
              reddedebilirsin.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReject}
                className="riso-focus flex-1 border-2 border-carbon bg-paper-deep text-carbon py-2 text-xs font-bold uppercase tracking-[0.08em] font-riso-display transition-all hover:bg-paper-dim"
              >
                Reddet
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="riso-focus riso-press flex-1 border-2 border-carbon bg-riso-pink text-carbon py-2 text-xs font-bold uppercase tracking-[0.1em] font-riso-display transition-all riso-shadow-sm hover:-translate-y-[1px]"
              >
                Kabul Et
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot
  );
};
