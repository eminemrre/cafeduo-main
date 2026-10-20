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

const CONSENT_KEY = 'cookie_consent';

export type CookieConsentValue = 'accepted' | 'rejected' | 'pending';

export const readCookieConsent = (): CookieConsentValue => {
  if (typeof window === 'undefined') return 'pending';
  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (raw === 'true' || raw === 'accepted') return 'accepted';
  if (raw === 'false' || raw === 'rejected') return 'rejected';
  return 'pending';
};

interface CookieConsentProps {
  /** The public landing sets the banner in its own type and colours. */
  variant?: 'default' | 'landing';
}

export const CookieConsent: React.FC<CookieConsentProps> = ({ variant = 'default' }) => {
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

  if (variant === 'landing')
    return createPortal(
      <div role="region" aria-label="Çerez bildirimi" className="cdl-cookie">
        <h2>Çerezler</h2>
        <p>
          <span className="cdl-cookie-short">Çerez onayı gerekli.</span>
          <span className="cdl-cookie-more">
            Giriş için çerez onayı gerekir. Yalnızca gezeceksen reddedebilirsin.
          </span>
        </p>
        <div className="cdl-cookie-actions">
          <button type="button" className="cdl-cookie-reject" onClick={handleReject}>
            Reddet
          </button>
          <button type="button" className="cdl-cookie-accept" onClick={handleAccept}>
            Kabul et
          </button>
        </div>
      </div>,
      portalRoot
    );

  return createPortal(
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className="duo-scope pointer-events-none fixed bottom-4 left-4 right-4 z-[130] sm:left-auto sm:right-6 sm:bottom-6 sm:w-[24rem]"
    >
      <div className="duo-cookie-card pointer-events-auto relative bg-paper p-4">
        <h2 className="mb-1 font-candy-display text-[1.75rem] leading-none text-carbon">Çerezler</h2>
        <p className="mb-4 break-words text-[0.9375rem] leading-6 text-carbon font-candy-body">
          Giriş için çerez onayı gerekir. Yalnızca gezeceksen reddedebilirsin.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="duo-focus min-h-11 bg-paper-deep px-4 text-[0.9375rem] font-semibold text-carbon font-candy-body transition-colors hover:bg-paper-dim"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="duo-focus min-h-11 bg-candy-lokum px-4 text-[0.9375rem] font-semibold text-carbon font-candy-body transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Kabul et
          </button>
        </div>
      </div>
    </div>,
    portalRoot
  );
};
