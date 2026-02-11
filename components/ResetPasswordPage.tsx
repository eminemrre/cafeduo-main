import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';

const MIN_PASSWORD_LENGTH = 6;

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validate = () => {
    if (!token) {
      return 'Sıfırlama bağlantısı geçersiz veya eksik.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
    }
    if (password !== confirmPassword) {
      return 'Şifreler eşleşmiyor.';
    }
    return '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await api.auth.resetPassword(token, password);
      setSuccessMessage(response.message || 'Şifre başarıyla güncellendi.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Şifre güncellenemedi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rf-section min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-cyan-400/30 bg-[#060f24]/90 shadow-[0_24px_80px_rgba(0,0,0,0.55)] p-6 md:p-8">
        <p className="font-pixel text-[10px] tracking-[0.22em] text-cyan-200/80 uppercase">CafeDuo Güvenlik</p>
        <h1 className="font-display text-2xl md:text-3xl text-white mt-2 mb-3">Şifreyi Yenile</h1>
        <p className="text-slate-300 text-sm mb-5">
          Yeni bir şifre belirleyerek hesabınıza güvenli şekilde tekrar giriş yapabilirsiniz.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/45 bg-red-500/12 text-red-100 px-3 py-2.5 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-400/45 bg-emerald-500/12 text-emerald-100 px-3 py-2.5 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            {successMessage}
          </div>
        )}

        <form className="space-y-3.5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 block">Yeni Şifre</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-cyan-400/25 bg-[#081631] text-white outline-none focus:border-cyan-300 focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
                placeholder="Yeni şifre"
                autoComplete="new-password"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 block">Şifre Tekrar</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-cyan-400/25 bg-[#081631] text-white outline-none focus:border-cyan-300 focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
                placeholder="Yeni şifre tekrar"
                autoComplete="new-password"
              />
            </div>
          </label>

          <RetroButton
            type="submit"
            disabled={loading}
            className="w-full normal-case tracking-[0.08em] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Güncelleniyor...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Şifreyi Güncelle
                <ArrowRight size={16} />
              </span>
            )}
          </RetroButton>
        </form>

        <Link
          to="/"
          className="mt-4 inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          Ana sayfaya dön ve giriş yap
        </Link>
      </div>
    </section>
  );
};
