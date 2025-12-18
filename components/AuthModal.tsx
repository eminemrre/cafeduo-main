import React, { useState, useEffect } from 'react';
import { X, User, Mail, Lock, ArrowRight, AlertTriangle, Briefcase } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { User as UserType } from '../types';
import { api } from '../lib/api';
import { PAU_DEPARTMENTS } from '../constants';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'register';
  onLoginSuccess: (user: UserType) => void;
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

  // Form Fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setDepartment('');
  }, [initialMode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!username || username.length < 3) {
          throw new Error('Kullanıcı adı en az 3 karakter olmalıdır.');
        }
        if (!email || !email.includes('@')) {
          throw new Error('Geçerli bir e-posta adresi girin.');
        }
        if (!password || password.length < 6) {
          throw new Error('Şifre en az 6 karakter olmalıdır.');
        }
        const user = await api.auth.register(username, email, password);
        onLoginSuccess(user);
      } else {
        // Login
        if (!email || !password) {
          throw new Error('E-posta ve şifre gereklidir.');
        }
        const user = await api.auth.login(email, password);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Firebase error messages
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('E-posta veya şifre hatalı.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Bu e-posta zaten kullanımda.');
      } else if (err.code === 'auth/weak-password') {
        setError('Şifre çok zayıf, en az 6 karakter olmalı.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi.');
      } else {
        setError(err.message || 'Bir hata oluştu.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await api.auth.googleLogin();
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Google auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google giriş penceresi kapatıldı.');
      } else {
        setError(err.message || 'Google ile giriş başarısız.');
      }
    } finally {
      setIsLoading(false);
    }
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
      <div className="relative w-full max-w-md bg-[#1a1f2e] border-4 border-gray-500 border-t-white border-l-white border-b-gray-800 border-r-gray-800 shadow-2xl">

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
              onClick={() => setMode('login')}
              className={`pb-1 border-b-2 transition-colors ${mode === 'login' ? 'text-white border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => setMode('register')}
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
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Kullanıcı Adı"
                    className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all"
                  />
                </div>

                <div className="relative group">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400 z-10" size={20} />
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-10 outline-none font-sans text-sm transition-all appearance-none cursor-pointer hover:bg-black/50"
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta"
                className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400" size={20} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                minLength={6}
                className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all"
              />
            </div>

            <RetroButton
              variant="primary"
              type="submit"
              className="w-full py-3 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                  <ArrowRight size={16} />
                </>
              )}
            </RetroButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-600"></div>
            <span className="text-gray-500 text-xs">veya</span>
            <div className="flex-1 h-px bg-gray-600"></div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google ile {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>

          {/* Footer Text */}
          <p className="text-center text-xs text-gray-500">
            {mode === 'login'
              ? "Hesabın yok mu? Yukarıdan 'Kayıt Ol' seçeneğine tıkla."
              : "Zaten hesabın var mı? Yukarıdan 'Giriş Yap' seçeneğine tıkla."}
          </p>
        </div>
      </div>
    </div>
  );
};