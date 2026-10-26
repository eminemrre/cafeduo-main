import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import './ResetPasswordPage.css';

type Outcome = 'checking' | 'verified' | 'already' | 'expired' | 'invalid' | 'error';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

const HEADINGS: Record<Outcome, string> = {
  checking: 'E-postanı doğruluyoruz',
  verified: 'E-postan doğrulandı',
  already: 'E-postan zaten doğrulanmış',
  expired: 'Bağlantının süresi dolmuş',
  invalid: 'Bağlantı geçersiz',
  error: 'Şu an doğrulayamadık',
};

/** `/dogrula?token=…`: the link from the verification e-mail. */
export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const wellFormed = TOKEN_PATTERN.test(token);
  const [outcome, setOutcome] = useState<Outcome>(wellFormed ? 'checking' : 'invalid');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState('');
  /** The link is single use: confirm it once even when effects run twice. */
  const confirmedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!wellFormed || confirmedRef.current === token) return;
    confirmedRef.current = token;
    api.auth
      .verifyEmail(token)
      .then((result) => setOutcome(result.status === 'already' ? 'already' : 'verified'))
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.code === 'VERIFICATION_EXPIRED') setOutcome('expired');
        else if (error instanceof ApiRequestError && error.status === 400) setOutcome('invalid');
        else setOutcome('error');
      });
  }, [token, wellFormed]);

  const resend = async () => {
    setResendError('');
    setResendState('sending');
    try {
      await api.auth.resendVerification();
      setResendState('sent');
    } catch (error: unknown) {
      setResendState('idle');
      setResendError(
        error instanceof ApiRequestError && error.status === 401
          ? 'Yeni bağlantı için önce giriş yap; panelden de isteyebilirsin.'
          : 'Bağlantı gönderilemedi. Biraz sonra yeniden dene.'
      );
    }
  };

  const done = outcome === 'verified' || outcome === 'already';

  return (
    <section className="duo-recovery" aria-labelledby="verify-title">
      <div className="duo-recovery-card">
        <h1 id="verify-title">{HEADINGS[outcome]}</h1>

        {outcome === 'checking' && (
          <p className="duo-recovery-description" role="status">
            Bir saniye…
          </p>
        )}
        {done && (
          <p className="duo-recovery-description">
            {outcome === 'verified'
              ? 'Teşekkürler. Hesabın hazır; masana katılıp ilk oyununu açabilirsin.'
              : 'Bu adres daha önce doğrulanmış. Yapman gereken bir şey yok.'}
          </p>
        )}
        {(outcome === 'expired' || outcome === 'invalid' || outcome === 'error') && (
          <p className="duo-recovery-description">
            {outcome === 'expired'
              ? 'Doğrulama bağlantıları 24 saat geçerli ve en yenisi geçerli. Yeni bir bağlantı isteyebilirsin.'
              : outcome === 'invalid'
                ? 'E-postandaki bağlantının tamamını açtığından emin ol ya da yeni bir bağlantı iste.'
                : 'Bağlantıda sorun olmayabilir; biraz sonra yeniden dene.'}
          </p>
        )}

        {(outcome === 'expired' || outcome === 'invalid') && (
          <>
            {resendState === 'sent' ? (
              <p className="duo-recovery-description" role="status">
                Yeni bağlantıyı gönderdik. Gelen kutunu (ve gereksiz klasörünü) kontrol et.
              </p>
            ) : (
              <button
                type="button"
                className="duo-recovery-cta duo-focus"
                onClick={() => void resend()}
                disabled={resendState === 'sending'}
              >
                Yeni bağlantı gönder
              </button>
            )}
            {resendError && (
              <div className="duo-recovery-error" role="alert">
                {resendError}
              </div>
            )}
          </>
        )}

        {outcome !== 'checking' && (
          <Link to="/dashboard" className="duo-recovery-cta duo-focus">
            CafeDuo'ya git <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
};

export default VerifyEmailPage;
