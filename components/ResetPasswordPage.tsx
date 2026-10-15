import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import './ResetPasswordPage.css';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;

/** A different recovery link starts a fresh form, including any pending request. */
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  return <PasswordResetForm key={token} token={token} />;
};

const PasswordResetForm: React.FC<{ token: string }> = ({ token }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const submittingRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const invalidLink = token.length < 32;

  useEffect(() => {
    if (successMessage) headingRef.current?.focus({ preventScroll: true });
  }, [successMessage]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || invalidLink || successMessage) return;
    setError('');

    const errors: typeof fieldErrors = {};
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      errors.password = `Şifre ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} karakter arasında olmalı.`;
    }
    if (!confirmPassword) errors.confirmation = 'Yeni şifreni tekrar yaz.';
    else if (password !== confirmPassword) errors.confirmation = 'Şifreler eşleşmiyor.';
    setFieldErrors(errors);
    if (errors.password || errors.confirmation) {
      (errors.password ? passwordRef : confirmationRef).current?.focus();
      return;
    }

    // Guard synchronously as well as disabling controls during the request.
    submittingRef.current = true;
    setLoading(true);
    try {
      const response = await api.auth.resetPassword(token, password);
      if (!response.success)
        throw new Error(response.message || 'Şifre güncellenemedi. Tekrar dene.');
      setSuccessMessage(
        response.message || 'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.'
      );
      setPassword('');
      setConfirmPassword('');
      setShowPasswords(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Şifre güncellenemedi. Tekrar dene.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="duo-recovery" aria-labelledby="recovery-title">
      <div className="duo-recovery-card">
        <div className="duo-recovery-icon" aria-hidden="true">
          {successMessage ? <CheckCircle2 size={28} /> : <LockKeyhole size={28} />}
        </div>
        <p className="duo-recovery-eyebrow">Hesabına yeniden bağlan</p>
        <h1 id="recovery-title" ref={headingRef} tabIndex={-1}>
          {successMessage
            ? 'Şifren hazır.'
            : invalidLink
              ? 'Bağlantıyı kontrol edelim.'
              : 'Yeni şifreni belirle.'}
        </h1>

        {successMessage ? (
          <>
            <p className="duo-recovery-description" role="status">
              {successMessage}
            </p>
            <Link to="/?auth=login" className="duo-recovery-cta riso-focus">
              Giriş yap <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </>
        ) : invalidLink ? (
          <>
            <p className="duo-recovery-description">Sıfırlama bağlantısı geçersiz veya eksik.</p>
            <p className="duo-recovery-description">
              E-postandaki bağlantının tamamını aç. Yeni bir bağlantı almak için giriş ekranındaki
              “Şifremi unuttum” seçeneğini kullanabilirsin.
            </p>
            <Link to="/?auth=login" className="duo-recovery-cta riso-focus">
              Giriş ekranına git <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <p className="duo-recovery-description">
              Yeni şifreni kaydet, kahve molana kaldığın yerden devam et.
            </p>
            {error && (
              <div className="duo-recovery-error" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}
            <form noValidate onSubmit={handleSubmit} aria-busy={loading}>
              <Input
                ref={passwordRef}
                id="recovery-password"
                label="Yeni şifre"
                name="password"
                type={showPasswords ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors({});
                  setError('');
                }}
                placeholder="Yeni şifre"
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                required
                disabled={loading}
                minLength={MIN_PASSWORD_LENGTH}
                helperText={`En az ${MIN_PASSWORD_LENGTH}, en fazla ${MAX_PASSWORD_LENGTH} karakter.`}
                errorText={fieldErrors.password}
              />
              <Input
                ref={confirmationRef}
                id="recovery-confirmation"
                label="Şifre tekrar"
                name="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setFieldErrors((previous) => ({ password: previous.password }));
                  setError('');
                }}
                placeholder="Yeni şifre tekrar"
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                required
                disabled={loading}
                errorText={fieldErrors.confirmation}
              />
              <button
                type="button"
                className="duo-recovery-visibility riso-focus"
                aria-pressed={showPasswords}
                disabled={loading}
                onClick={() => setShowPasswords((shown) => !shown)}
              >
                {showPasswords ? 'Şifreleri gizle' : 'Şifreleri göster'}
              </button>
              <Button type="submit" tone="blue" block disabled={loading}>
                {loading ? 'Şifre kaydediliyor…' : 'Şifreyi güncelle'}
              </Button>
              <p className="duo-recovery-progress" role="status">
                {loading ? 'Şifren güvenle kaydediliyor. Lütfen bekle.' : ''}
              </p>
            </form>
            {error && (
              <p className="duo-recovery-help">
                Bağlantının süresi dolduysa{' '}
                <Link to="/?auth=login" className="riso-focus">
                  giriş ekranındaki “Şifremi unuttum” seçeneğinden
                </Link>{' '}
                yeni bir bağlantı isteyebilirsin.
              </p>
            )}
          </>
        )}
        <Link to="/" className="duo-recovery-back riso-focus">
          <ArrowLeft size={16} aria-hidden="true" /> Ana sayfaya dön
        </Link>
      </div>
    </section>
  );
};
