import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { RetroButton } from './RetroButton';

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[#0f141a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0f141a] to-[#0f141a]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="mb-6 inline-block animate-float">
          <div className="px-4 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-pixel tracking-widest uppercase">
            ✨ Yeni Nesil Sosyal Kafe
          </div>
        </div>

        <h1 className="font-black text-6xl md:text-8xl lg:text-9xl mb-6 tracking-tighter">
          <span className="block text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">CAFE</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-pixel mt-[-10px] md:mt-[-20px]">
            DUO
          </span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Kahveni yudumla, oyununu oyna, ödülleri topla.
          <br />
          <span className="text-white font-medium">Sosyalleşmenin en eğlenceli hali.</span>
        </p>

        <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
          {isLoggedIn ? (
            <RetroButton
              onClick={handlePanelClick}
              className="min-w-[200px] py-4 text-lg group"
              variant="primary"
            >
              PANEL'E GİT <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </RetroButton>
          ) : (
            <>
              <RetroButton
                onClick={onRegister}
                className="min-w-[200px] py-4 text-lg group"
                variant="primary"
              >
                HEMEN BAŞLA <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </RetroButton>

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