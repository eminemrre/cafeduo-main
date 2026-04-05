import React from 'react';
import { UserPlus, Coffee, Trophy, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: <UserPlus size={22} className="text-sky-400" />,
    title: 'Hesabını aç',
    description: '30 saniyede profilini tamamla ve oyuncu kimliğini aktive et.',
    hint: '20 sn',
  },
  {
    id: '02',
    icon: <Coffee size={22} className="text-violet-400" />,
    title: 'Kafeye bağlan',
    description: 'Kafeni seç, güvenli girişi tamamla ve lobiye gir.',
    hint: '15 sn',
  },
  {
    id: '03',
    icon: <Trophy size={22} className="text-amber-400" />,
    title: 'Eşleş ve kazan',
    description: 'Bekleyen oyuncuyla maça gir, turu bitir, puanı hesabına yaz.',
    hint: '45 sn',
  },
];

export const HowItWorks: React.FC = () => (
  <section id="features" className="cd-section" aria-label="Nasıl çalışır">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="cd-kicker">NASIL ÇALIŞIR</span>
        <h2
          data-testid="flow-main-heading"
          className="mt-4 text-3xl md:text-5xl font-display text-white"
        >
          3 adımda eşleş, oyna, ödüle yaklaş.
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Arkadaşını beklerken boşta kalma; bağlan, eşleş ve puanı topla.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {steps.map((step, index) => (
          <article
            key={step.id}
            data-testid={`how-step-${step.id}`}
            className="relative glass rounded-2xl p-6 border border-slate-700/40 bg-slate-900/60 transition-all duration-300 hover:-translate-y-2 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/20"
          >
            <span className="absolute top-4 right-4 text-slate-800 font-display text-4xl select-none pointer-events-none">
              {step.id}
            </span>

            <div className="w-11 h-11 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-4">
              {step.icon}
            </div>

            <h3 className="text-xl font-display text-white mb-2">{step.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>

            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-sm">
              <span className="text-[10px] tracking-wider text-slate-400 uppercase font-bold">Ortalama</span>
              <span className="text-white font-semibold">{step.hint}</span>
            </div>

            {index < steps.length - 1 && (
              <div className="hidden md:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900 border border-slate-700/40 z-10">
                <ChevronRight size={14} className="text-slate-500" />
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  </section>
);
