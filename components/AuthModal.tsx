import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Lock, ArrowRight, AlertTriangle, Briefcase, Check, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { RetroButton } from './RetroButton';
import { User as UserType } from '../types';
import { api } from '../lib/api';
import { PAU_DEPARTMENTS } from '../constants';
import { useToast } from '../contexts/ToastContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'register';
  onLoginSuccess: (user: UserType) => void;
}

// Validation rules
const VALIDATION = {
  username: {
    min: 3,
    max: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Kullanıcı adı 3-20 karakter, sadece harf, rakam ve alt çizgi içerebilir'
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Geçerli bir e-posta adresi girin'
  },
  password: {
    min: 6,
    max: 50,
    message: 'Şifre en az 6 karakter olmalıdır'
  }
};

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

interface AuthLikeError {
  code?: string;
  message?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState(initialMode);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Toast hook
  const toast = useToast();

  // Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    setMode(initialMode);
    resetForm();
  }, [initialMode, isOpen]);

  const resetForm = () => {
    setError('');
    setForgotMessage('');
    setIsForgotPasswordMode(false);
    setFieldErrors({});
    setTouched({});
    setUsername('');
    setEmail('');
    setPassword('');
    setDepartment('');
    setShowPassword(false);
  };

  // Real-time validation
  const validateField = (field: keyof FieldErrors, value: string): string | undefined => {
    switch (field) {
      case 'username':
        if (mode !== 'register') return undefined;
        if (!value) return 'Kullanıcı adı gereklidir';
        if (value.length < VALIDATION.username.min) return `En az ${VALIDATION.username.min} karakter`;
        if (value.length > VALIDATION.username.max) return `En fazla ${VALIDATION.username.max} karakter`;
        if (!VALIDATION.username.pattern.test(value)) return 'Sadece harf, rakam ve alt çizgi';
        return undefined;
      case 'email':
        if (!value) return 'E-posta adresi gereklidir';
        if (!VALIDATION.email.pattern.test(value)) return VALIDATION.email.message;
        return undefined;
      case 'password':
        if (!value) return 'Şifre gereklidir';
        if (value.length < VALIDATION.password.min) return VALIDATION.password.message;
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (field: keyof FieldErrors) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === 'username' ? username : field === 'email' ? email : password;
    const error = validateField(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleChange = (field: keyof FieldErrors, value: string) => {
    switch (field) {
      case 'username':
        setUsername(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
    }
    // Clear error when user types
    if (touched[field]) {
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    if (isForgotPasswordMode) {
      errors.email = validateField('email', email);
    } else {
      if (mode === 'register') {
        errors.username = validateField('username', username);
      }
      errors.email = validateField('email', email);
      errors.password = validateField('password', password);
    }

    // Remove undefined errors
    const cleanErrors: FieldErrors = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (value) cleanErrors[key as keyof FieldErrors] = value;
    });

    setFieldErrors(cleanErrors);
    setTouched(
      isForgotPasswordMode
        ? { email: true }
        : { username: true, email: true, password: true }
    );
    
    return Object.keys(cleanErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    if (!validateForm()) {
      toast.error('Lütfen form hatalarını düzeltin');
      return;
    }

    setIsLoading(true);

    try {
      if (isForgotPasswordMode) {
        const response = await api.auth.forgotPassword(email);
        setForgotMessage(response.message);
        toast.success(response.message);
      } else if (mode === 'register') {
        const user = await api.auth.register(username, email, password);
        onLoginSuccess(user);
      } else {
        const user = await api.auth.login(email, password);
        onLoginSuccess(user);
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      let errorMessage = 'Bir hata oluştu.';
      const authErr = (typeof err === 'object' && err !== null ? err : {}) as AuthLikeError;
      const errCode = String(authErr.code || '');
      
      // Firebase error messages
      if (errCode === 'auth/wrong-password' || errCode === 'auth/user-not-found') {
        errorMessage = 'E-posta veya şifre hatalı.';
      } else if (errCode === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta zaten kullanımda.';
      } else if (errCode === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf, en az 6 karakter olmalı.';
      } else if (errCode === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi.';
      } else if (authErr.message) {
        errorMessage = authErr.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setIsForgotPasswordMode(false);
    setForgotMessage('');
    setError('');
    setFieldErrors({});
    setTouched({});
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    const credential = String(credentialResponse.credential || '');
    if (!credential) {
      const message = 'Google kimlik doğrulaması alınamadı.';
      setError(message);
      toast.error(message);
      return;
    }

    setError('');
    setForgotMessage('');
    setIsLoading(true);
    try {
      const user = await api.auth.googleLogin(credential);
      onLoginSuccess(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google ile giriş başarısız.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass =
    'rf-input rf-control h-12 text-white text-base md:text-lg leading-none';
  const inputBorderClass =
    'border-slate-600 focus:border-cyan-300 focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]';
  const inputErrorClass =
    'border-red-500 focus:border-red-500 focus:shadow-[0_0_20px_rgba(255,86,114,0.2)]';
  const iconBaseClass =
    'absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-300';
  const googleClientId =
    typeof window !== 'undefined'
      ? String((window as Window & { __CAFEDUO_GOOGLE_CLIENT_ID__?: string }).__CAFEDUO_GOOGLE_CLIENT_ID__ || '').trim()
      : '';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Container - Full screen on mobile, centered on desktop */}
        <motion.div
          className="relative w-full sm:max-w-[520px] max-h-[92vh] bg-[linear-gradient(170deg,rgba(8,14,30,0.97),rgba(10,24,52,0.9))] border border-cyan-400/28 shadow-[0_30px_70px_rgba(0,0,0,0.55)] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col rf-elevated"
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Drag handle for mobile */}
          <div className="sm:hidden w-full pt-3 pb-1 flex justify-center" onClick={onClose}>
            <div className="w-12 h-1.5 bg-cyan-200/25 rounded-full" />
          </div>

          {/* Header Bar */}
          <div className="px-5 md:px-6 py-4 flex justify-between items-start border-b border-cyan-400/22 flex-shrink-0 bg-[#050f23]/88">
            <div>
              <p className="font-pixel text-cyan-200/85 tracking-[0.2em] text-[10px] md:text-xs uppercase">
                Güvenli Erişim
              </p>
              <span className="font-display text-white tracking-[0.03em] text-base md:text-lg">
                {mode === 'login' ? 'Giriş Merkezi' : 'Kayıt Merkezi'}
              </span>
            </div>
            <motion.button
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-cyan-300/45 text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/20 flex items-center justify-center transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <X size={17} />
            </motion.button>
          </div>

          {/* Content - Scrollable on mobile */}
          <div className="p-4 sm:p-6 md:p-7 flex-1 overflow-y-auto rf-modal-scroll flex flex-col gap-5">

            <div className="rounded-xl border border-cyan-400/20 bg-[#050d20]/90 p-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`h-10 rf-control rounded-lg text-sm md:text-base font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-cyan-500/18 text-cyan-100 border border-cyan-300/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Giriş Yap
              </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`h-10 rf-control rounded-lg text-sm md:text-base font-semibold transition-all ${
                  mode === 'register'
                    ? 'bg-cyan-500/18 text-cyan-100 border border-cyan-300/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-400/45 text-red-100 px-3 py-2.5 rounded-lg flex items-center gap-2 text-sm">
                <AlertTriangle size={16} className="shrink-0" />
                {error}
              </div>
            )}
            {forgotMessage && (
              <div className="bg-emerald-500/12 border border-emerald-400/35 text-emerald-100 px-3 py-2.5 rounded-lg text-sm">
                {forgotMessage}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>

              {mode === 'register' && !isForgotPasswordMode && (
                <>
                  <div className="relative group">
                    <User className={iconBaseClass} size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      onBlur={() => handleBlur('username')}
                      placeholder="Kullanıcı adı"
                      className={`${inputBaseClass} ${
                        fieldErrors.username && touched.username ? inputErrorClass : inputBorderClass
                      } pl-11 pr-10`}
                    />
                    {!fieldErrors.username && touched.username && username && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                    )}
                  </div>
                  {fieldErrors.username && touched.username && (
                    <p className="text-red-300 text-xs flex items-center gap-1">
                      <AlertTriangle size={12} /> {fieldErrors.username}
                    </p>
                  )}

                  <div className="relative group">
                    <Briefcase className={`${iconBaseClass} z-10`} size={18} />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={`${inputBaseClass} ${inputBorderClass} pl-11 pr-11 appearance-none cursor-pointer`}
                    >
                      <option value="" className="bg-[#0b152c] text-slate-300">
                        Bölüm seçiniz (isteğe bağlı)
                      </option>
                      {PAU_DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept} className="bg-[#0b152c] text-white">
                          {dept}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                    />
                  </div>
                </>
              )}

              <div className="relative group">
                <Mail className={iconBaseClass} size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="E-posta"
                  data-testid="auth-email-input"
                  className={`${inputBaseClass} ${
                    fieldErrors.email && touched.email ? inputErrorClass : inputBorderClass
                  } pl-11 pr-10`}
                />
                {!fieldErrors.email && touched.email && email && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                )}
              </div>
              {fieldErrors.email && touched.email && (
                <p className="text-red-300 text-xs flex items-center gap-1">
                  <AlertTriangle size={12} /> {fieldErrors.email}
                </p>
              )}

              {!isForgotPasswordMode && (
                <>
                  <div className="relative group">
                    <Lock className={iconBaseClass} size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      onBlur={() => handleBlur('password')}
                      placeholder="Şifre"
                      data-testid="auth-password-input"
                      className={`${inputBaseClass} ${
                        fieldErrors.password && touched.password ? inputErrorClass : inputBorderClass
                      } pl-11 pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.password && touched.password && (
                    <p className="text-red-300 text-xs flex items-center gap-1">
                      <AlertTriangle size={12} /> {fieldErrors.password}
                    </p>
                  )}
                </>
              )}

              {mode === 'login' && !isForgotPasswordMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordMode(true);
                    setError('');
                    setForgotMessage('');
                  }}
                  className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  Şifremi unuttum
                </button>
              )}

              <RetroButton
                type="submit"
                disabled={isLoading}
                data-testid="auth-submit-button"
                className="w-full mt-2 normal-case tracking-[0.06em] text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed rf-control"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isForgotPasswordMode
                      ? 'Bağlantı gönderiliyor...'
                      : mode === 'login'
                        ? 'Giriş yapılıyor...'
                        : 'Kayıt yapılıyor...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {isForgotPasswordMode
                      ? 'Sıfırlama Bağlantısı Gönder'
                      : mode === 'login'
                        ? 'Giriş Yap'
                        : 'Kayıt Ol'}
                    <ArrowRight size={17} />
                  </span>
                )}
              </RetroButton>
            </form>

            {mode === 'login' && !isForgotPasswordMode && googleClientId && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500 text-xs uppercase tracking-[0.12em]">
                  <span className="h-px flex-1 bg-slate-700/80" />
                  veya
                  <span className="h-px flex-1 bg-slate-700/80" />
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => {
                      setError('Google ile giriş işlemi başlatılamadı.');
                      toast.error('Google ile giriş işlemi başlatılamadı.');
                    }}
                    theme="filled_black"
                    shape="pill"
                    text="continue_with"
                    width="320"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {mode === 'login' && !isForgotPasswordMode && (
                <p className="text-center text-slate-400 text-sm">
                  Hesabınız yok mu?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors font-semibold"
                  >
                    Kayıt olun
                  </button>
                </p>
              )}
              {mode === 'login' && isForgotPasswordMode && (
                <p className="text-center text-slate-400 text-sm">
                  Şifrenizi hatırladınız mı?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPasswordMode(false);
                      setError('');
                    }}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors font-semibold"
                  >
                    Giriş ekranına dön
                  </button>
                </p>
              )}
              <p className="text-center text-[11px] text-slate-500">
                Giriş sonrası hesabınızın rolüne göre otomatik olarak uygun panele yönlendirilirsiniz.
              </p>
            </div>
          </div>
        </motion.div>
    </motion.div>
  </AnimatePresence>
  );
};
