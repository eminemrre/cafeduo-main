import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Lock, ArrowRight, AlertTriangle, Briefcase, Check, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { RetroButton } from './RetroButton';
import { CyberMascot, MascotMood } from './CyberMascot';
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
    'w-full h-12 bg-black/40 border-2 text-cyan-50 font-body text-base group-[.is-error]:text-red-100 outline-none transition-all duration-200 placeholder:text-cyan-800/60 pl-11 pr-4 skew-x-[-2deg]';
  const inputBorderClass =
    'border-cyan-900/40 focus:border-cyan-400 focus:shadow-[4px_4px_0_rgba(34,211,238,0.2)] focus:skew-x-0 focus:-translate-y-0.5 focus:-translate-x-0.5';
  const inputErrorClass =
    'border-red-500/50 focus:border-red-400 focus:shadow-[4px_4px_0_rgba(239,68,68,0.3)] focus:skew-x-0 focus:-translate-y-0.5 focus:-translate-x-0.5';
  const iconBaseClass =
    'absolute left-4 top-1/2 -translate-y-1/2 text-cyan-700 pointer-events-none transition-colors group-focus-within:text-cyan-400 group-[.is-error]:text-red-400 z-10 skew-x-[2deg] group-focus-within:skew-x-0';
  const googleClientId =
    typeof window !== 'undefined'
      ? String((window as Window & { __CAFEDUO_GOOGLE_CLIENT_ID__?: string }).__CAFEDUO_GOOGLE_CLIENT_ID__ || '').trim()
      : '';

  const mascotMood: MascotMood = error || Object.keys(fieldErrors).length > 0
    ? 'angry'
    : (username.length > 0 || email.length > 0 || password.length > 0) ? 'typing' : 'neutral';

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
          className="absolute inset-0 bg-[#02050f]/85 backdrop-blur-sm noise-bg"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Container Wrapper for absolute positioning */}
        <div className="relative w-full sm:max-w-[520px]">
          {/* Mascot */}
          <CyberMascot mood={mascotMood} className="hidden sm:block absolute -top-[70px] right-[40px] z-10" />

          <motion.div
            className="relative w-full h-full max-h-[92vh] bg-[#050a19] border-t-2 border-r-4 border-b-4 border-l-2 border-t-cyan-400 border-r-pink-500 border-b-pink-500 border-l-cyan-400 shadow-[10px_10px_0px_rgba(0,0,0,0.8)] sm:rounded-none overflow-hidden flex flex-col noise-bg"
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Drag handle for mobile */}
            <div className="sm:hidden w-full pt-3 pb-1 flex justify-center" onClick={onClose}>
              <div className="w-12 h-1.5 bg-cyan-900/50 rounded-none skew-x-[-20deg]" />
            </div>

            {/* Header Bar */}
            <div className="px-5 md:px-6 py-4 flex justify-between items-start border-b-2 border-cyan-900/50 flex-shrink-0 bg-black/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-400 to-transparent opacity-50"></div>
              <div>
                <p className="font-body text-cyan-400 tracking-widest text-xs uppercase font-bold relative inline-block">
                  Güvenli Erişim
                  <span className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-pink-500 animate-pulse"></span>
                </p>
                <h2 className="font-display text-white text-3xl md:text-3xl uppercase mt-1 tracking-wider glitch-text" data-text={mode === 'login' ? 'GİRİŞ MERKEZİ' : 'KAYIT MERKEZİ'}>
                  {mode === 'login' ? 'GİRİŞ MERKEZİ' : 'KAYIT MERKEZİ'}
                </h2>
              </div>
              <motion.button
                onClick={onClose}
                className="w-10 h-10 border-2 border-cyan-900/50 text-cyan-400 bg-black/50 hover:border-pink-500 hover:text-pink-500 flex items-center justify-center transition-colors skew-x-[-10deg] group"
                whileHover={{ scale: 1.05, skewX: 0 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={20} className="skew-x-[10deg] group-hover:skew-x-0" />
              </motion.button>
            </div>

            {/* Content - Scrollable on mobile */}
            <div className="p-4 sm:p-6 md:p-7 flex-1 overflow-y-auto flex flex-col gap-5">

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`flex-1 h-12 font-display text-lg uppercase tracking-wider transition-all border-b-2 skew-x-[-5deg] ${mode === 'login'
                    ? 'text-cyan-400 border-cyan-400 bg-cyan-950/30'
                    : 'text-[var(--rf-muted)] border-cyan-900/45 hover:text-cyan-200 hover:bg-cyan-950/25'
                    }`}
                >
                  <span className="block skew-x-[5deg]">GİRİŞ YAP</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`flex-1 h-12 font-display text-lg uppercase tracking-wider transition-all border-b-2 skew-x-[5deg] ${mode === 'register'
                    ? 'text-pink-400 border-pink-500 bg-pink-950/20'
                    : 'text-[var(--rf-muted)] border-cyan-900/45 hover:text-cyan-200 hover:bg-cyan-950/25'
                    }`}
                >
                  <span className="block skew-x-[-5deg]">KAYIT OL</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border-l-4 border-red-500 text-red-200 px-4 py-3 font-body text-sm flex items-center gap-3 animate-pulse">
                  <AlertTriangle size={18} className="shrink-0 text-red-500" />
                  {error}
                </div>
              )}
              {forgotMessage && (
                <div className="bg-cyan-500/10 border-l-4 border-cyan-400 text-cyan-200 px-4 py-3 font-body text-sm">
                  {forgotMessage}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>

                {mode === 'register' && !isForgotPasswordMode && (
                  <>
                    <div className={`relative group ${fieldErrors.username && touched.username ? 'is-error' : ''}`}>
                      <User className={iconBaseClass} size={18} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleChange('username', e.target.value)}
                        onBlur={() => handleBlur('username')}
                        placeholder="Kullanıcı adı"
                        className={`${inputBaseClass} ${fieldErrors.username && touched.username ? inputErrorClass : inputBorderClass
                          }`}
                      />
                      {!fieldErrors.username && touched.username && username && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400" size={18} />
                      )}
                    </div>
                    {fieldErrors.username && touched.username && (
                      <p className="text-red-300 text-xs flex items-center gap-1 font-body">
                        <AlertTriangle size={12} /> {fieldErrors.username}
                      </p>
                    )}

                    <div className={`relative group`}>
                      <Briefcase className={`${iconBaseClass} z-10`} size={18} />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className={`${inputBaseClass} ${inputBorderClass} rf-input-icon-double appearance-none cursor-pointer`}
                      >
                        <option value="" className="bg-black text-[var(--rf-muted)]">
                          Bölüm seçiniz (isteğe bağlı)
                        </option>
                        {PAU_DEPARTMENTS.map(dept => (
                          <option key={dept} value={dept} className="bg-black border-2 border-cyan-900/50 text-white font-body px-2">
                            {dept}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-600/70"
                      />
                    </div>
                  </>
                )}

                <div className={`relative group ${fieldErrors.email && touched.email ? 'is-error' : ''}`}>
                  <Mail className={iconBaseClass} size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="E-posta"
                    data-testid="auth-email-input"
                    className={`${inputBaseClass} ${fieldErrors.email && touched.email ? inputErrorClass : inputBorderClass
                      }`}
                  />
                  {!fieldErrors.email && touched.email && email && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400" size={18} />
                  )}
                </div>
                {fieldErrors.email && touched.email && (
                  <p className="text-red-300 text-xs flex items-center gap-1 font-body">
                    <AlertTriangle size={12} /> {fieldErrors.email}
                  </p>
                )}

                {!isForgotPasswordMode && (
                  <>
                    <div className={`relative group ${fieldErrors.password && touched.password ? 'is-error' : ''}`}>
                      <Lock className={iconBaseClass} size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="Şifre"
                        data-testid="auth-password-input"
                        className={`${inputBaseClass} ${fieldErrors.password && touched.password ? inputErrorClass : inputBorderClass
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-600 hover:text-cyan-400 transition-colors"
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.password && touched.password && (
                      <p className="text-red-300 text-xs flex items-center gap-1 font-body">
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
                    className="text-sm font-body text-cyan-400/80 hover:text-cyan-300 hover:underline transition-colors block text-right w-full"
                  >
                    Şifremi unuttum
                  </button>
                )}

                <RetroButton
                  type="submit"
                  disabled={isLoading}
                  data-testid="auth-submit-button"
                  className="w-full mt-4 normal-case text-lg font-display tracking-widest disabled:opacity-50 disabled:cursor-not-allowed group"
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
                  <div className="flex items-center gap-3 text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em]">
                    <span className="h-px flex-1 bg-cyan-900/70" />
                    veya
                    <span className="h-px flex-1 bg-cyan-900/70" />
                  </div>
                  <div className="flex justify-center">
                    <div className="google-login-shell w-full max-w-[320px] overflow-hidden rounded-full" data-testid="auth-google-login-shell">
                      <GoogleLogin
                        key={googleClientId}
                        onSuccess={handleGoogleLogin}
                        onError={() => {
                          setError('Google ile giriş işlemi başlatılamadı.');
                          toast.error('Google ile giriş işlemi başlatılamadı.');
                        }}
                        theme="filled_black"
                        shape="pill"
                        text="continue_with"
                        width="300"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {mode === 'login' && !isForgotPasswordMode && (
                  <p className="text-center text-[var(--rf-muted)] text-sm">
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
                  <p className="text-center text-[var(--rf-muted)] text-sm">
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
                <p className="text-center text-[11px] text-[var(--rf-muted)]">
                  Giriş sonrası hesabınızın rolüne göre otomatik olarak uygun panele yönlendirilirsiniz.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
