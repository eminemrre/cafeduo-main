import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, ArrowRight, AlertTriangle, Briefcase, Check, Eye, EyeOff } from 'lucide-react';
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

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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
    
    if (mode === 'register') {
      errors.username = validateField('username', username);
    }
    errors.email = validateField('email', email);
    errors.password = validateField('password', password);

    // Remove undefined errors
    const cleanErrors: FieldErrors = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (value) cleanErrors[key as keyof FieldErrors] = value;
    });

    setFieldErrors(cleanErrors);
    setTouched({ username: true, email: true, password: true });
    
    return Object.keys(cleanErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    if (!validateForm()) {
      toast.showToast('Lütfen form hatalarını düzeltin', 'error');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        const user = await api.auth.register(username, email, password);
        toast.showToast('Kayıt başarılı! Hoş geldiniz 🎉', 'success');
        onLoginSuccess(user);
      } else {
        const user = await api.auth.login(email, password);
        toast.showToast(`Hoş geldin ${user.username}!`, 'success');
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMessage = 'Bir hata oluştu.';
      
      // Firebase error messages
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = 'E-posta veya şifre hatalı.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta zaten kullanımda.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf, en az 6 karakter olmalı.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      toast.showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setTouched({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-[#1a1f2e] border-4 border-gray-500 border-t-white border-l-white border-b-gray-800 border-r-gray-800 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">

        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 px-4 py-2 flex justify-between items-center border-b-4 border-gray-800">
          <span className="font-pixel text-white tracking-widest">
            {mode === 'login' ? 'GIRIS_YAP.EXE' : 'KAYIT_OL.EXE'}
          </span>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white p-1 border-2 border-red-300 border-b-red-800 border-r-red-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col gap-6">

          <div className="flex justify-center gap-4 font-pixel text-sm mb-4">
            <button
              onClick={() => switchMode('login')}
              className={`pb-1 border-b-2 transition-colors ${mode === 'login' ? 'text-white border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`pb-1 border-b-2 transition-colors ${mode === 'register' ? 'text-white border-purple-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              Kayıt Ol
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded flex items-center gap-2 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>

            {mode === 'register' && (
              <>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400" size={20} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    onBlur={() => handleBlur('username')}
                    placeholder="Kullanıcı Adı"
                    className={`w-full bg-black/30 border-2 ${fieldErrors.username && touched.username ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-blue-500'} text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]`}
                  />
                  {!fieldErrors.username && touched.username && username && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                  )}
                </div>
                {fieldErrors.username && touched.username && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> {fieldErrors.username}
                  </p>
                )}

                <div className="relative group">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 z-10" size={20} />
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-10 outline-none font-sans text-sm transition-all appearance-none cursor-pointer hover:bg-black/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                    >
                      <option value="" className="bg-gray-900 text-gray-400">Bölüm Seçiniz (İsteğe Bağlı)</option>
                      {PAU_DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept} className="bg-gray-900 text-white py-2">{dept}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="E-posta"
                className={`w-full bg-black/30 border-2 ${fieldErrors.email && touched.email ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-blue-500'} text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]`}
              />
              {!fieldErrors.email && touched.email && email && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
              )}
            </div>
            {fieldErrors.email && touched.email && (
              <p className="text-red-400 text-xs -mt-3 flex items-center gap-1">
                <AlertTriangle size={12} /> {fieldErrors.email}
              </p>
            )}

            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder="Şifre"
                className={`w-full bg-black/30 border-2 ${fieldErrors.password && touched.password ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-blue-500'} text-white py-3 pl-10 pr-12 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {fieldErrors.password && touched.password && (
              <p className="text-red-400 text-xs -mt-3 flex items-center gap-1">
                <AlertTriangle size={12} /> {fieldErrors.password}
              </p>
            )}

            <RetroButton
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Giriş Yapılıyor...' : 'Kayıt Yapılıyor...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                  <ArrowRight size={18} />
                </span>
              )}
            </RetroButton>
          </form>

          {mode === 'login' && (
            <p className="text-center text-gray-500 text-sm">
              Hesabınız yok mu?{' '}
              <button
                onClick={() => switchMode('register')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Kayıt olun
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
