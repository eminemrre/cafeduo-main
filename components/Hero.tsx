import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Coffee, TimerReset } from 'lucide-react';
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
    <section id="home" className="relative min-h-screen pt-28 md:pt-32 overflow-hidden">
      <div className="absolute inset-0 cd-dot-grid opacity-45" />
      <div className="absolute -left-20 top-28 h-64 w-64 rounded-full bg-[#be7b43]/25 blur-3xl" />
      <div className="absolute right-0 top-20 h-[22rem] w-[22rem] rounded-full bg-[#1f6f78]/22 blur-3xl" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-8 h-32 w-11/12 max-w-5xl rounded-full bg-[#73543c]/14 blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <span className="cd-kicker mb-5">Kafe icin sosyal oyun platformu</span>
            <h1 className="font-display text-[2.6rem] md:text-[4.1rem] leading-[1.06] text-[#1f2328] tracking-tight">
              Kahve ritmini
              <span className="text-[#1f6f78]"> mini oyunlarla </span>
              birlestiren yeni nesil deneyim.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-[#4f5b68] max-w-2xl leading-relaxed">
              CafeDuo, kafelerde oturan insanlari saniyeler icinde oyuna baglar.
              Giris yap, masani sec, hizli oyunlarla puan topla ve odulleri aninda kullan.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              {isLoggedIn ? (
                <RetroButton
                  onClick={handlePanelClick}
                  className="min-w-[210px] py-3.5 text-[0.95rem] md:text-base"
                  variant="primary"
                >
                  PANEL'E GIT <ArrowRight className="ml-2" size={18} />
                </RetroButton>
              ) : (
                <>
                  <ABTest
                    testName="hero_cta_text"
                    variantA={
                      <RetroButton
                        onClick={onRegister}
                        className="min-w-[210px] py-3.5 text-[0.95rem] md:text-base"
                        variant="primary"
                      >
                        HEMEN BASLA <ArrowRight className="ml-2" size={18} />
                      </RetroButton>
                    }
                    variantB={
                      <RetroButton
                        onClick={onRegister}
                        className="min-w-[210px] py-3.5 text-[0.95rem] md:text-base"
                        variant="primary"
                      >
                        UCRETSIZ KAYDOL <Sparkles className="ml-2" size={18} />
                      </RetroButton>
                    }
                  />

                  <RetroButton
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    className="min-w-[210px] py-3.5 text-[0.95rem] md:text-base"
                    variant="secondary"
                  >
                    GIRIS YAP
                  </RetroButton>
                </>
              )}
            </div>

            <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              <div className="cd-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-[#6f7a86] uppercase">Sure</p>
                <p className="text-2xl font-bold text-[#1f2328] mt-1">45 sn</p>
                <p className="text-sm text-[#5f6b78] mt-1">Ortalama mac suresi</p>
              </div>
              <div className="cd-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-[#6f7a86] uppercase">Mod</p>
                <p className="text-2xl font-bold text-[#1f2328] mt-1">3+</p>
                <p className="text-sm text-[#5f6b78] mt-1">Hizli tuketilen oyun</p>
              </div>
              <div className="cd-panel p-4">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-[#6f7a86] uppercase">Odul</p>
                <p className="text-2xl font-bold text-[#1f2328] mt-1">Anlik</p>
                <p className="text-sm text-[#5f6b78] mt-1">Kupon ve puan dongusu</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="cd-panel p-6 md:p-8 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#1f6f78]/18" />
              <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#be7b43]/18" />

              <h3 className="font-display text-3xl text-[#1f2328] mb-5">Mekanda oyunu baslat</h3>
              <div className="space-y-4">
                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/60 border border-[#dcc7b1]">
                  <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#1f6f78]/15 text-[#1f6f78] flex items-center justify-center">
                    <Coffee size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1f2328]">Kafeye giris yap</p>
                    <p className="text-sm text-[#5b6774]">QR ile masayi sec ve saniyeler icinde basla.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/60 border border-[#dcc7b1]">
                  <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#be7b43]/20 text-[#8c5527] flex items-center justify-center">
                    <TimerReset size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1f2328]">Hizli tur, yuksek tekrar</p>
                    <p className="text-sm text-[#5b6774]">Kisa oyunlar sayesinde bekleme degil etkileşim olur.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-[#1f2328] p-4 text-white">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-[#c4d2dd] uppercase">Canli gozlem</p>
                <p className="text-sm mt-2 text-[#d4dde6]">
                  Oyun odakli bu yapi, kafe yoneticisi icin sureci izlenebilir hale getirir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
