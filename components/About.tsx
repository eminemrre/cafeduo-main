import React from 'react';
import { Heart, Code, Coffee, Globe, Server, Shield, Zap, Users } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <section id="about" className="py-24 bg-[#0f141a] relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Content */}
          <div>
            <span className="text-blue-400 font-medium tracking-widest uppercase text-sm mb-2 block">Biz Kimiz?</span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              KAFELER İÇİN <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">DİJİTAL ALTYAPI</span>
            </h2>

            <div className="space-y-6 text-gray-400 text-lg leading-relaxed">
              <p>
                CafeDuo, kafelere özel geliştirilmiş <strong>yeni nesil bir oyun ve sosyalleşme altyapısıdır</strong>.
                İşletmelere sunduğumuz bu dijital çözüm ile müşterilerinize sadece kahve değil,
                unutulmaz bir deneyim sunmanızı sağlıyoruz.
              </p>
              <p>
                Kafeler için geliştirdiğimiz bu sistem sayesinde müşteri sadakatini artırıyor
                ve mekanınızı dijital bir oyun alanına dönüştürüyoruz.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-10">
              <div className="bg-[#151921] p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-blue-500/30 transition-colors">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
                  <Server size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold">Altyapı</h4>
                  <span className="text-xs text-gray-500">Güçlü sunucular</span>
                </div>
              </div>
              <div className="bg-[#151921] p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-purple-500/30 transition-colors">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold">Hız</h4>
                  <span className="text-xs text-gray-500">Anlık etkileşim</span>
                </div>
              </div>
              <div className="bg-[#151921] p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-green-500/30 transition-colors">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center text-green-400">
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold">Güvenli</h4>
                  <span className="text-xs text-gray-500">Veri koruması</span>
                </div>
              </div>
              <div className="bg-[#151921] p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-orange-500/30 transition-colors">
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-400">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold">B2B</h4>
                  <span className="text-xs text-gray-500">İşletme dostu</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-2xl opacity-20 animate-pulse-slow"></div>
            <div className="relative bg-[#151921] border border-gray-800 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none"></div>

              <div className="flex flex-col items-center text-center gap-6 py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-12 hover:rotate-0 transition-transform duration-500">
                  <Code size={48} className="text-white" />
                </div>

                <div>
                  <h3 className="text-3xl font-black text-white mb-2">CAFE DUO</h3>
                  <p className="text-gray-400">Since 2024</p>
                </div>

                <div className="w-full h-[1px] bg-gray-800 my-4"></div>

                <div className="flex gap-4 sm:gap-8 justify-center w-full">
                  <div className="text-center">
                    <span className="block text-xl sm:text-2xl font-bold text-white">WEB</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Uygulamasız</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xl sm:text-2xl font-bold text-white">QR</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Hızlı Erişim</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xl sm:text-2xl font-bold text-white">7/24</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Kesintisiz</span>
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