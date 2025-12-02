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
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setDepartment('');
    setVerificationCode('');
    setIsVerifying(false);
  }, [initialMode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (!isVerifying) {
          // Step 1: Register (Send Code)
          const response = await api.auth.register(username, email, password, department);
          if (response.requireVerification) {
            setIsVerifying(true);
            if (response.devCode) {
              console.log("DEV CODE:", response.devCode);
              alert(`Geliştirici Modu Kodu: ${response.devCode}`);
            }
          } else {
            // Should not happen with new logic, but fallback
            onLoginSuccess(response);
          }
        } else {
          // Step 2: Verify Code
          const user = await api.auth.verify(email, verificationCode);
          onLoginSuccess(user);
        }
      } else {
        // Login Call
        const user = await api.auth.login(email, password);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
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
      <div className="relative w-full max-w-md bg-[#1a1f2e] border-4 border-gray-500 border-t-white border-l-white border-b-gray-800 border-r-gray-800 shadow-2xl animate-pulse-slow">

        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 px-4 py-2 flex justify-between items-center border-b-4 border-gray-800">
          <span className="font-pixel text-white tracking-widest animate-pulse">
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

            {mode === 'register' && !isVerifying && (
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
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(!isVerifying || mode === 'login') && (
              <>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-400" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-posta Adresi"
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
                    className="w-full bg-black/30 border-2 border-gray-600 focus:border-blue-500 text-white py-3 pl-10 pr-4 outline-none font-retro text-xl placeholder:text-gray-600 transition-all"
                  />
                </div>
              </>
            )}

            {isVerifying && (
              <div className="relative group animate-fade-in-up">
                <div className="text-center mb-2 text-green-400 text-sm">
                  E-postana gönderilen 6 haneli kodu gir:
                </div>
                <input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Doğrulama Kodu"
                  className="w-full bg-black/30 border-2 border-green-500 focus:border-green-400 text-white py-3 text-center outline-none font-mono text-2xl tracking-widest placeholder:text-gray-600 transition-all"
                  maxLength={6}
                />
              </div>
            )}

            <RetroButton variant="primary" className="w-full mt-6 flex items-center justify-center gap-2" type="submit">
              {isLoading ? (
                <span className="animate-pulse">ISLENIYOR...</span>
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'BAŞLA' : (isVerifying ? 'DOĞRULA VE GİR' : 'KAYIT OL')}
                  </span>
                  <ArrowRight size={20} />
                </>
              )}
            </RetroButton>
          </form>

          <div className="text-center font-retro text-gray-400">
            {mode === 'login' ? (
              <p>Hesabın yok mu? <button onClick={() => setMode('register')} className="text-blue-400 hover:underline">Hemen Kaydol</button></p>
            ) : (
              <p>Zaten hesabın var mı? <button onClick={() => setMode('login')} className="text-blue-400 hover:underline">Giriş Yap</button></p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};