/**
 * "E-postanı doğrula" band on the player panel. Verification never blocks
 * play; the band only offers a fresh link. Closing it hides it for the rest
 * of the browser session (read in an effect, never during render).
 */
import React, { useEffect, useState } from 'react';
import { MailCheck, X } from 'lucide-react';
import { api, ApiRequestError } from '../../lib/api';

const dismissKey = (userId: string | number | undefined) =>
  `cafeduo:email-verify-banner-dismissed:${userId ?? 'anonymous'}`;

export const EmailVerifyBanner: React.FC<{
  userId?: string | number;
  emailVerified?: boolean;
}> = ({ userId, emailVerified }) => {
  /** null until the session flag is read, so a dismissed band never flashes. */
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let hidden = false;
    try {
      hidden = window.sessionStorage.getItem(dismissKey(userId)) === '1';
    } catch {
      // Storage may be blocked; the band then simply stays.
    }
    setDismissed(hidden);
  }, [userId]);

  if (emailVerified !== false || dismissed !== false) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(dismissKey(userId), '1');
    } catch {
      // Hidden for this view only.
    }
  };

  const resend = async () => {
    setError('');
    setState('sending');
    try {
      await api.auth.resendVerification();
      setState('sent');
    } catch (err: unknown) {
      setState('idle');
      setError(
        err instanceof ApiRequestError && err.status === 429
          ? 'Kısa sürede çok kez istedin; biraz sonra yeniden dene.'
          : 'Bağlantı gönderilemedi. Biraz sonra yeniden dene.'
      );
    }
  };

  return (
    <section className="duo-verify-band" role="region" aria-label="E-posta doğrulama">
      <MailCheck size={20} aria-hidden="true" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="duo-verify-band-title">E-postanı doğrula</p>
        {state === 'sent' ? (
          <p className="duo-verify-band-text" role="status">
            Yeni bağlantıyı gönderdik; gelen kutunu kontrol et.
          </p>
        ) : (
          <p className="duo-verify-band-text">
            Şifreni unutursan sana ulaşabilmemiz için e-postandaki bağlantıya tıkla.
          </p>
        )}
        {error && (
          <p className="duo-verify-band-text" role="alert">
            {error}
          </p>
        )}
      </div>
      {state !== 'sent' && (
        <button
          type="button"
          className="duo-verify-band-action duo-focus"
          onClick={() => void resend()}
          disabled={state === 'sending'}
        >
          Tekrar gönder
        </button>
      )}
      <button type="button" className="duo-verify-band-close duo-focus" onClick={close} aria-label="Kapat">
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
};
