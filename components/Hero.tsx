import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Coffee, Play, Sparkles, Timer, Trophy, Users, WalletCards } from 'lucide-react';

interface HeroProps {
  onLogin: () => void;
  onRegister: () => void;
  isLoggedIn?: boolean;
  userRole?: string;
  isAdmin?: boolean;
}

const tableRows = [
  { label: 'PAÜ Merkez Cafe', value: '4/4 aktif', tone: 'text-[#39ff6a]' },
  { label: 'Retro Satranç', value: 'Masa 05', tone: 'text-white' },
  { label: 'Nişancı Düellosu', value: '+120 CP', tone: 'text-[#ff3045]' },
];

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
    <section
      id="home"
      aria-label="Ana bölüm"
      className="cd-hero-shell relative min-h-screen overflow-hidden"
    >
      <div className="cd-topline absolute left-0 right-0 top-24 z-[3] overflow-hidden py-2.5 sm:top-28">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 text-sm font-semibold text-white sm:px-6 lg:px-8">
          <span className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2">Yüz yüze oyun</span>
          <span className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2">Anlık masa eşleşmesi</span>
          <span className="rounded-full border border-[#ff2d3d]/30 bg-[#ff2d3d]/10 px-4 py-2 text-[#ff4d5a]">ödül ekonomisi</span>
        </div>
      </div>

      <div className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[1320px] items-center px-4 pb-24 pt-44 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.9fr)_minmax(340px,0.72fr)]">
          <div className="cd-hero-copy max-w-4xl text-center lg:max-w-[470px] lg:text-left">
            <p className="cd-kicker justify-center lg:justify-start">
              Gamer ruhunu al, kafeni seç, masanı doğrula
            </p>

            <h1 lang="tr" className="mt-7 text-[3.4rem] font-black uppercase leading-[0.95] text-white sm:text-7xl lg:text-[4.1rem]">
              Kafede oyun oynamak artık <span className="text-[#ff3045]">efsane <span>kolay.</span></span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-neutral-400 sm:text-xl lg:mx-0">
              Kafeni seç, masanı doğrula ve rekabete katıl. Puan kazan,
              ödülleri topla, efsaneler arasında yerini al.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              {isLoggedIn ? (
                <button
                  onClick={handlePanelClick}
                  aria-label="Kontrol paneline git"
                  className="cd-button-primary group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-bold transition-all duration-200"
                >
                  Panele Geç <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                </button>
              ) : (
                <>
                  <button
                    onClick={onRegister}
                    aria-label="Kayıt ol ve oyuna başla"
                    className="cd-button-primary group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-bold transition-all duration-200"
                  >
                    CafeDuo'ya Başla <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                  </button>

                  <button
                    onClick={onLogin}
                    data-testid="hero-login-button"
                    aria-label="Oturum aç"
                    className="cd-button-secondary inline-flex items-center justify-center gap-3 px-7 py-4 text-sm font-bold transition-all duration-200"
                  >
                    <Play size={17} /> Oturum Aç
                  </button>
                </>
              )}
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 text-left sm:max-w-xl lg:max-w-lg">
              <div className="cd-mini-stat border-[#10e7ff]/45">
                <Timer size={16} />
                <span>Hızlı eşleşme</span>
              </div>
              <div className="cd-mini-stat border-[#ff3045]/45">
                <Users size={16} />
                <span>Canlı masalar</span>
              </div>
              <div className="cd-mini-stat border-[#39ff6a]/45">
                <Trophy size={16} />
                <span>Puan & ödül</span>
              </div>
            </div>
          </div>

          <div className="cd-arcade-scene mx-auto w-full max-w-[420px] lg:max-w-none">
            <div className="cd-arcade-screen">
              <div className="cd-pixel-trophy">
                <Trophy size={72} />
              </div>
              <div className="cd-level-sign">LEVEL<br />UP</div>
              <div className="cd-player cd-player-left" />
              <div className="cd-player cd-player-right" />
              <div className="cd-table-glow" />
              <div className="cd-spark cd-spark-a"><Sparkles size={18} /></div>
              <div className="cd-spark cd-spark-b"><Sparkles size={14} /></div>
            </div>
            <div className="cd-active-seat">
              <div>
                <p className="font-pixel text-[10px] uppercase text-[#10e7ff]">Senin aktif masan</p>
                <p className="mt-1 text-sm text-white">Retro Satranç - PAÜ Merkez Cafe</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-[#a5adb8]">Puanın</p>
                <p className="font-pixel text-lg text-[#ff3045]">350 CP</p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[390px] lg:mx-0 lg:justify-self-end">
            <div className="cd-product-panel p-4 sm:p-5">
              <div className="cd-product-window overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="cd-brand-mark flex h-10 w-10 items-center justify-center">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Canlı Masalar</p>
                      <p className="text-xs text-neutral-500">18 aktif</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#ff3045] px-3 py-1 text-[10px] font-bold uppercase text-white">
                    Aktif
                  </span>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <p className="text-xs font-semibold uppercase text-[#10e7ff]">Senin masan</p>
                      <p className="mt-2 text-5xl font-black leading-none text-white">05</p>
                      <p className="mt-1 text-sm text-neutral-400">Retro Satranç hazır</p>
                    </div>
                    <div className="flex w-28 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-right">
                      <WalletCards className="ml-auto text-[#ff2d3d]" size={19} />
                      <div>
                        <p className="text-3xl font-black text-white">840</p>
                        <p className="text-xs text-neutral-500">CP</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {tableRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <span className="text-sm text-neutral-300">{row.label}</span>
                        <span className={`text-xs font-bold ${row.tone}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-neutral-500">
                      <span>Tur ilerlemesi</span>
                      <span className="text-white">78%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[78%] rounded-full bg-[#ff2d3d]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
