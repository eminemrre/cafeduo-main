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
                    className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                  />
                </div>

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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta"
                className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]"
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
                className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.25)]"
              />
            </div>

            <RetroButton
              variant="primary"
              type="submit"
              className="w-full py-3 flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(59,130,246,0.25)]"
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
