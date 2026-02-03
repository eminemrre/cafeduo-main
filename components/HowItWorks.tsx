import React from 'react';
import { UserPlus, Coffee, Trophy, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      id: 1,
      icon: <UserPlus size={32} className="text-blue-400" />,
      title: "HESAP OLUŞTUR",
      description: "Hızlıca kayıt ol ve CafeDuo dünyasına adım at. İlk 100 puanın bizden!"
    },
    {
      id: 2,
      icon: <Coffee size={32} className="text-orange-400" />,
      title: "KONUMUNU DOĞRULA",
      description: "Kafeye gittiğinde konumunu doğrula ve oturduğun masayı seç."
    },
    {
      id: 3,
      icon: <Trophy size={32} className="text-yellow-400" />,
      title: "OYNA & KAZAN",
      description: "Rakiplerinle yarış, oyunları kazan ve topladığın puanlarla bedava kahve iç!"
    }
  ];

  return (
    <section id="features" className="py-24 bg-[#0f141a] relative overflow-hidden">

      {/* Background Elements */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-purple-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="text-center mb-20">
          <span className="text-blue-400 font-medium tracking-widest uppercase text-sm mb-2 block">Sistem Nasıl İşler?</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            3 ADIMDA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">KAZAN</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            CafeDuo ile eğlenceye katılmak çok kolay. Sadece birkaç dakika içinde oyunlara başla.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.id} className="relative group">

              {/* Connector Line (Desktop) */}
              {index !== steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 right-[-50%] w-full h-[2px] bg-gradient-to-r from-gray-800 to-transparent z-0 transform -translate-y-1/2"></div>
              )}

              <div className="relative z-10 bg-[#151921] border border-gray-800 p-8 rounded-2xl hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-2 group-hover:shadow-[0_20px_50px_rgba(59,130,246,0.18)] h-full flex flex-col items-center text-center">

                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_12px_25px_rgba(0,0,0,0.35)]">
                  {step.icon}
                </div>

                <h3 className="text-xl font-bold text-white mb-4 font-pixel tracking-wide">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {step.description}
                </p>

                {/* Step Number */}
                <div className="absolute top-4 right-4 text-4xl font-black text-gray-800/50 select-none">
                  0{step.id}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
