import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LEGAL_VERSION } from '../lib/legal/seller';

const NOTICE_KEY = 'cafeduo_cookie_notice';

/** Necessary cookies need an explanation, not an advertising-consent gate. */
export const CookieConsent: React.FC<{ variant?: 'default' | 'landing' }> = ({
  variant = 'default',
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try {
        setVisible(window.localStorage.getItem(NOTICE_KEY) !== LEGAL_VERSION);
      } catch {
        // Storage may be disabled. The notice must still be readable and dismissible.
        setVisible(true);
      }
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(NOTICE_KEY, LEGAL_VERSION);
    } catch {
      // Persistence is optional; dismissal still works for this page visit.
    }
    setVisible(false);
  };

  if (!visible || typeof document === 'undefined') return null;
  const landing = variant === 'landing';
  return createPortal(
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className={
        landing
          ? 'cdl-cookie'
          : 'duo-scope fixed bottom-4 left-4 right-4 z-[40] sm:left-auto sm:right-6 sm:bottom-6 sm:w-[24rem]'
      }
    >
      <div className={landing ? 'contents' : 'duo-cookie-card bg-paper p-4'}>
        <h2
          className={
            landing ? undefined : 'mb-1 font-candy-display text-[1.75rem] leading-none text-carbon'
          }
        >
          Çerezler
        </h2>
        <p
          className={
            landing ? undefined : 'mb-4 text-[0.9375rem] leading-6 text-carbon font-candy-body'
          }
        >
          {landing
            ? 'Yalnızca zorunlu çerezler kullanıyoruz.'
            : 'Yalnızca oturum ve güvenlik için zorunlu çerezler kullanıyoruz. Reklam veya analitik çerezi yok.'}{' '}
          <a href="/cerezler" className="duo-focus underline underline-offset-4">
            Çerez politikası
          </a>
        </p>
        <div className={landing ? 'cdl-cookie-actions' : 'flex justify-end'}>
          <button
            type="button"
            onClick={dismiss}
            className={
              landing
                ? 'cdl-cookie-accept'
                : 'duo-focus min-h-11 bg-candy-lokum px-4 text-[0.9375rem] font-semibold text-carbon font-candy-body'
            }
          >
            Bildirimi kapat
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
