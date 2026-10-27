import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { LEGAL_VERSION } from '../../lib/legal/seller';

type TermsReceipt = { termsVersion: string; termsAcceptedAt: string };

/** Non-blocking. A view, dismissal or continued play is never recorded as agreement. */
export const TermsUpdateBanner: React.FC<{
  termsVersion?: string | null;
  onAccepted: (receipt: TermsReceipt) => void;
}> = ({ termsVersion, onAccepted }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const accept = async () => {
    setPending(true);
    setError('');
    try {
      const receipt = await api.auth.acceptTerms(LEGAL_VERSION);
      if (mounted.current) onAccepted(receipt);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Koşul kabulü kaydedilemedi. Yeniden deneyebilirsin.'
        );
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  if (termsVersion === LEGAL_VERSION) return null;
  return (
    <div className="px-5 pt-28">
      <section
        aria-label="Güncellenen kullanım koşulları"
        className="mx-auto max-w-5xl bg-paper-deep p-5 text-carbon font-candy-body sm:p-6"
      >
        <h2 className="font-candy-display text-[1.75rem] leading-tight">
          Kullanım koşullarımız güncellendi
        </h2>
        <p className="mt-3 leading-relaxed">
          Yeni metni inceleyebilirsin. Bu bildirim oyun oynamanı engellemez; kabulün yalnız
          aşağıdaki düğmeye bastığında kaydedilir.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href="/kosullar"
            target="_blank"
            rel="noopener noreferrer"
            className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Kullanım koşulları
          </a>
          <a
            href="/gizlilik"
            target="_blank"
            rel="noopener noreferrer"
            className="duo-focus inline-flex min-h-11 items-center underline underline-offset-4"
          >
            KVKK aydınlatma metni
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={accept}
            className="duo-focus min-h-12 bg-carbon px-5 text-paper font-semibold disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor…' : 'Okudum, kabul ediyorum'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-candy-danger-text">
            {error}
          </p>
        )}
      </section>
    </div>
  );
};
