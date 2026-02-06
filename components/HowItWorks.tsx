import React from 'react';
import { UserPlus, Coffee, Trophy, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: <UserPlus size={24} className="text-[#1f6f78]" />,
    title: 'Hesabini ac',
    description: 'Kayit ol, profilini tamamla ve ilk puanini aninda aktif et.',
    hint: '20 sn',
  },
  {
    id: '02',
    icon: <Coffee size={24} className="text-[#be7b43]" />,
    title: 'Masani dogrula',
    description: 'Kafede konumunu dogrula, masa secimini yap ve oyun lobbysine gir.',
    hint: '15 sn',
  },
  {
    id: '03',
    icon: <Trophy size={24} className="text-[#4f6980]" />,
    title: 'Yaris ve kazan',
    description: 'Mini oyun turunu bitir, puan kazan ve kuponunu kasada okut.',
    hint: '45 sn',
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="features" className="cd-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="cd-kicker">Sistem akisi</span>
          <h2 className="mt-4 text-4xl md:text-5xl font-display text-[#1f2328]">Uygulamayi 3 adimda hayata gecir.</h2>
          <p className="mt-4 text-lg text-[#53606d]">
            Akis kafede bekleme yaratmaz. Her adim hizli, olculebilir ve personel tarafinda yonetilebilir.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, index) => (
            <article key={step.id} className="cd-panel p-6 md:p-7 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-[#d5c0aa] font-display text-5xl">{step.id}</div>

              <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#d4bca4] flex items-center justify-center mb-5">
                {step.icon}
              </div>

              <h3 className="text-2xl font-semibold text-[#1f2328] mb-3">{step.title}</h3>
              <p className="text-[#55616e] leading-relaxed">{step.description}</p>

              <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fff3e5] border border-[#dfc3a6]">
                <span className="font-pixel text-[10px] tracking-[0.16em] text-[#7e5f46] uppercase">Ortalama</span>
                <span className="text-sm font-semibold text-[#4d5662]">{step.hint}</span>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#f3e6d7] border border-[#d6bda4]">
                  <ChevronRight size={14} className="text-[#6f7b86]" />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
