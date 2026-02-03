import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { ABTest } from './ABTest';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

export const Hero: React.FC<HeroProps> = ({ onLogin, onRegister, isLoggedIn, userRole, isAdmin }) => {
  const navigate = useNavigate();

  const handlePanelClick = () => {
    if (isAdmin) {
      navigate('/admin');
    } else if (userRole === 'cafe_admin') {
      navigate('/cafe-admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[#0f141a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-[#0f141a] to-[#0f141a]"></div>
        <div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(59,130,246,0.12),rgba(168,85,247,0.12),rgba(244,114,182,0.12),rgba(59,130,246,0.12))] opacity-30 blur-3xl"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1 text-yellow-300 text-xs font-pixel tracking-widest uppercase shadow-[0_0_20px_rgba(234,179,8,0.12)]">
          <span className="inline-flex h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>
          Yeni Nesil Sosyal Kafe
        </div>

        <h1 className="font-black text-6xl md:text-8xl lg:text-9xl mb-6 tracking-tighter">
          <span className="block text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">CAFE</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-pixel mt-[-10px] md:mt-[-20px]">
            DUO
          </span>
        </h1>

        <p className="text-gray-300/80 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Kahveni yudumla, oyununu oyna, ödülleri topla.
          <br />
          <span className="text-white font-medium">Sosyalleşmenin en eğlenceli hali.</span>
        </p>

        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          {isLoggedIn ? (
            <RetroButton
              onClick={handlePanelClick}
              className="min-w-[200px] py-4 text-lg group shadow-[0_12px_30px_rgba(59,130,246,0.25)]"
              variant="primary"
            >
              PANEL'E GİT <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </RetroButton>
          ) : (
            <>
              <ABTest
                testName="hero_cta_text"
                variantA={
                  <RetroButton
                    onClick={onRegister}
                    className="min-w-[200px] py-4 text-lg group shadow-[0_12px_30px_rgba(59,130,246,0.25)]"
                    variant="primary"
                  >
                    HEMEN BAŞLA <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </RetroButton>
                }
                variantB={
                  <RetroButton
                    onClick={onRegister}
                    className="min-w-[200px] py-4 text-lg group shadow-[0_12px_30px_rgba(59,130,246,0.25)]"
                    variant="primary"
                  >
                    ÜCRETSİZ KAYDOL <Sparkles className="ml-2 group-hover:rotate-12 transition-transform" />
                  </RetroButton>
                }
              />

              <RetroButton
                onClick={onLogin}
                className="min-w-[200px] py-4 text-lg"
                variant="secondary"
              >
                GİRİŞ YAP
              </RetroButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
